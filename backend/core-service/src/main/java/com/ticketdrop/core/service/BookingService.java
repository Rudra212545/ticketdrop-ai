package com.ticketdrop.core.service;

import com.ticketdrop.core.domain.entity.*;
import com.ticketdrop.core.domain.enums.BookingStatus;
import com.ticketdrop.core.domain.enums.EventStatus;
import com.ticketdrop.core.domain.enums.SeatStatus;
import com.ticketdrop.core.domain.enums.SeatingMode;
import com.ticketdrop.core.domain.enums.TicketStatus;
import com.ticketdrop.core.dto.BookingDtos.*;
import com.ticketdrop.core.exception.ApiException;
import com.ticketdrop.core.repository.*;
import com.ticketdrop.events.KafkaTopics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);

    private final EventRepository eventRepository;
    private final SeatRepository seatRepository;
    private final SeatTierRepository seatTierRepository;
    private final BookingRepository bookingRepository;
    private final TicketRepository ticketRepository;
    private final StandingHoldRepository standingHoldRepository;
    private final UserRepository userRepository;
    private final RedisSeatLockService redisSeatLockService;
    private final OutboxService outboxService;
    private final SeatMapBroadcaster seatMapBroadcaster;
    private final String qrSigningSecret;

    public BookingService(
            EventRepository eventRepository,
            SeatRepository seatRepository,
            SeatTierRepository seatTierRepository,
            BookingRepository bookingRepository,
            TicketRepository ticketRepository,
            StandingHoldRepository standingHoldRepository,
            UserRepository userRepository,
            RedisSeatLockService redisSeatLockService,
            OutboxService outboxService,
            SeatMapBroadcaster seatMapBroadcaster,
            @Value("${app.jwt.secret}") String qrSigningSecret
    ) {
        this.eventRepository = eventRepository;
        this.seatRepository = seatRepository;
        this.seatTierRepository = seatTierRepository;
        this.bookingRepository = bookingRepository;
        this.ticketRepository = ticketRepository;
        this.standingHoldRepository = standingHoldRepository;
        this.userRepository = userRepository;
        this.redisSeatLockService = redisSeatLockService;
        this.outboxService = outboxService;
        this.seatMapBroadcaster = seatMapBroadcaster;
        this.qrSigningSecret = qrSigningSecret;
    }

    @Transactional
    public LockSeatsResponse lockSeats(UUID eventId, UUID userId, LockSeatsRequest req) {
        Event event = eventRepository.findWithOrganizerById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));
        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw new ApiException(HttpStatus.CONFLICT, "Event Not Open", "This event is not currently open for booking.");
        }
        if (event.isFlashSaleEnabled() && !redisSeatLockService.isAdmittedToFlashSale(eventId, userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Waiting Room Required", "Please pass the Fair Queue before locking seats.");
        }

        List<UUID> uniqueSeatIds = req.seatIds().stream().distinct().toList();
        String lockToken = redisSeatLockService.tryAcquireSeatLocks(eventId, uniqueSeatIds, userId);
        if (lockToken == null) {
            throw new ApiException(HttpStatus.CONFLICT, "Seats Unavailable", "One or more selected seats are already locked by another fan.");
        }

        try {
            List<Seat> seats = seatRepository.findByIdInAndEventId(uniqueSeatIds, eventId);
            if (seats.size() != uniqueSeatIds.size()) {
                redisSeatLockService.releaseSeatLocks(eventId, uniqueSeatIds, userId);
                throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid Seats", "One or more seats do not belong to this event.");
            }

            Instant now = Instant.now();
            Instant expiresAt = now.plus(RedisSeatLockService.SEAT_LOCK_TTL);

            for (Seat seat : seats) {
                boolean expiredLock = seat.getStatus() == SeatStatus.LOCKED
                        && seat.getLockedUntil() != null
                        && seat.getLockedUntil().isBefore(now);
                boolean ownedLock = seat.getStatus() == SeatStatus.LOCKED && userId.equals(seat.getLockedBy());

                if (seat.getStatus() != SeatStatus.AVAILABLE && !expiredLock && !ownedLock) {
                    redisSeatLockService.releaseSeatLocks(eventId, uniqueSeatIds, userId);
                    throw new ApiException(
                            HttpStatus.CONFLICT,
                            "Seat Already Taken",
                            "Seat " + seat.getRowLabel() + seat.getSeatNumber() + " is no longer available."
                    );
                }

                seat.setStatus(SeatStatus.LOCKED);
                seat.setLockedBy(userId);
                seat.setLockedUntil(expiresAt);
            }

            // Release any stale locks previously held by this same user for other seats on this event
            Set<UUID> requestedSet = new HashSet<>(uniqueSeatIds);
            List<Seat> priorHeldSeats = seatRepository.findByEventIdAndLockedByAndStatus(eventId, userId, SeatStatus.LOCKED);
            List<UUID> staleIds = new ArrayList<>();
            for (Seat prior : priorHeldSeats) {
                if (!requestedSet.contains(prior.getId())) {
                    prior.setStatus(SeatStatus.AVAILABLE);
                    prior.setLockedBy(null);
                    prior.setLockedUntil(null);
                    staleIds.add(prior.getId());
                }
            }
            if (!staleIds.isEmpty()) {
                seatRepository.saveAll(priorHeldSeats);
                redisSeatLockService.releaseSeatLocks(eventId, staleIds, userId);
            }

            seatRepository.saveAllAndFlush(seats);
            seatMapBroadcaster.broadcastSeatChange(eventId, "SEATS_LOCKED");
            return new LockSeatsResponse(
                    eventId,
                    uniqueSeatIds,
                    lockToken,
                    expiresAt,
                    RedisSeatLockService.SEAT_LOCK_TTL.toSeconds()
            );
        } catch (OptimisticLockingFailureException ex) {
            redisSeatLockService.releaseSeatLocks(eventId, uniqueSeatIds, userId);
            throw new ApiException(HttpStatus.CONFLICT, "Concurrent Modification", "Another fan just claimed one of these seats. Please pick again.");
        }
    }

    @Transactional
    public BookingResponse checkout(UUID userId, String idempotencyKey, CheckoutRequest req) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Missing Idempotency-Key", "Idempotency-Key header is required for checkout.");
        }

        var existing = bookingRepository.findByIdempotencyKey(idempotencyKey.trim());
        if (existing.isPresent()) {
            Booking b = existing.get();
            if (!b.getUser().getId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Forbidden", "Idempotency key belongs to another user.");
            }
            return toBookingResponse(b);
        }

        Event event = eventRepository.findWithOrganizerById(req.eventId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User Not Found", "User not found."));

        List<UUID> uniqueSeatIds = req.seatIds().stream().distinct().toList();
        if (!redisSeatLockService.verifyUserOwnsAllLocks(req.eventId(), uniqueSeatIds, userId)) {
            throw new ApiException(HttpStatus.CONFLICT, "Lock Expired", "Your seat lock expired. Please re-select seats.");
        }

        List<Seat> seats = seatRepository.findByIdInAndEventId(uniqueSeatIds, req.eventId());
        Instant now = Instant.now();
        long subtotal = 0L;
        Instant earliestExpiry = now.plus(RedisSeatLockService.SEAT_LOCK_TTL);

        for (Seat seat : seats) {
            if (seat.getStatus() != SeatStatus.LOCKED || !userId.equals(seat.getLockedBy())
                    || seat.getLockedUntil() == null || seat.getLockedUntil().isBefore(now)) {
                throw new ApiException(HttpStatus.CONFLICT, "Seat Lock Invalid", "Lock expired for seat " + seat.getRowLabel() + seat.getSeatNumber());
            }
            subtotal += seat.getTier().getBasePricePaise();
            if (seat.getLockedUntil().isBefore(earliestExpiry)) {
                earliestExpiry = seat.getLockedUntil();
            }
        }

        int feeBps = event.getOrganizer().getPlatformFeeBps();
        long platformFee = (subtotal * feeBps) / 10_000L;

        Booking booking = new Booking();
        booking.setUser(user);
        booking.setEvent(event);
        booking.setIdempotencyKey(idempotencyKey.trim());
        booking.setPlatformFeePaise(platformFee);
        booking.setTotalAmountPaise(subtotal + platformFee);
        booking.setStatus(BookingStatus.PENDING_PAYMENT);
        booking.setExpiresAt(earliestExpiry);
        booking = bookingRepository.save(booking);

        return toBookingResponse(booking);
    }

    /**
     * 1-Click Open-Ground Standing Zone reservation & idempotent checkout using
     * atomic Redis Lua DECRBY (zero overselling under massive concert spikes).
     */
    @Transactional
    public BookingResponse checkoutStanding(UUID userId, String idempotencyKey, StandingCheckoutRequest req) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Missing Idempotency-Key", "Idempotency-Key header is required.");
        }

        var existing = bookingRepository.findByIdempotencyKey(idempotencyKey.trim());
        if (existing.isPresent()) {
            Booking b = existing.get();
            if (!b.getUser().getId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Forbidden", "Idempotency key belongs to another user.");
            }
            return toBookingResponse(b);
        }

        Event event = eventRepository.findWithOrganizerById(req.eventId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));
        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw new ApiException(HttpStatus.CONFLICT, "Event Not Open", "This event is not open for booking.");
        }
        if (event.getSeatingMode() != SeatingMode.STANDING) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seated Event", "Use seat selection for assigned-seating events.");
        }
        if (event.isFlashSaleEnabled() && !redisSeatLockService.isAdmittedToFlashSale(event.getId(), userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Waiting Room Required", "Please pass the Fair Queue first.");
        }

        int totalRequested = req.items().stream().mapToInt(ZoneQuantity::quantity).sum();
        if (totalRequested < 1 || totalRequested > 6) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pass Limit", "You can reserve between 1 and 6 passes per order.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User Not Found", "User not found."));

        List<ZoneQuantity> reservedInRedis = new ArrayList<>();
        List<SeatTier> updatedTiers = new ArrayList<>();
        long subtotal = 0L;

        try {
            for (ZoneQuantity item : req.items()) {
                SeatTier tier = seatTierRepository.findById(item.tierId())
                        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Zone Not Found", "Standing zone does not exist."));
                if (!tier.getEvent().getId().equals(event.getId())) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid Zone", "Zone does not belong to this event.");
                }
                if (tier.getAvailableSeats() < item.quantity()) {
                    throw new ApiException(HttpStatus.CONFLICT, "Zone Sold Out", "Not enough passes left in " + tier.getName());
                }

                boolean acquired = redisSeatLockService.tryReserveStandingPasses(
                        tier.getId(), tier.getAvailableSeats(), item.quantity()
                );
                if (!acquired) {
                    throw new ApiException(HttpStatus.CONFLICT, "Zone Sold Out", "Passes in " + tier.getName() + " were just claimed.");
                }
                reservedInRedis.add(item);

                tier.setAvailableSeats(tier.getAvailableSeats() - item.quantity());
                updatedTiers.add(tier);
                subtotal += tier.getBasePricePaise() * item.quantity();
            }

            seatTierRepository.saveAllAndFlush(updatedTiers);

            int feeBps = event.getOrganizer().getPlatformFeeBps();
            long platformFee = (subtotal * feeBps) / 10_000L;
            Instant expiresAt = Instant.now().plus(RedisSeatLockService.SEAT_LOCK_TTL);

            Booking booking = new Booking();
            booking.setUser(user);
            booking.setEvent(event);
            booking.setIdempotencyKey(idempotencyKey.trim());
            booking.setPlatformFeePaise(platformFee);
            booking.setTotalAmountPaise(subtotal + platformFee);
            booking.setStatus(BookingStatus.PENDING_PAYMENT);
            booking.setExpiresAt(expiresAt);
            booking = bookingRepository.save(booking);

            for (ZoneQuantity item : req.items()) {
                SeatTier tier = updatedTiers.stream().filter(t -> t.getId().equals(item.tierId())).findFirst().orElseThrow();
                StandingHold hold = new StandingHold();
                hold.setEvent(event);
                hold.setTier(tier);
                hold.setUser(user);
                hold.setBookingId(booking.getId());
                hold.setQuantity(item.quantity());
                hold.setStatus("HELD");
                hold.setExpiresAt(expiresAt);
                standingHoldRepository.save(hold);
            }

            seatMapBroadcaster.broadcastSeatChange(event.getId(), "STANDING_HELD");
            return toBookingResponse(booking);
        } catch (RuntimeException ex) {
            for (ZoneQuantity r : reservedInRedis) {
                redisSeatLockService.releaseStandingPasses(r.tierId(), r.quantity());
            }
            if (ex instanceof OptimisticLockingFailureException) {
                throw new ApiException(HttpStatus.CONFLICT, "High Demand", "Zone capacity just changed. Please try again.");
            }
            throw ex;
        }
    }

    @Transactional
    public BookingResponse confirmPayment(UUID bookingId, UUID userId, ConfirmPaymentRequest req) {
        Booking booking = bookingRepository.findWithEventById(bookingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Booking Not Found", "Booking does not exist."));
        if (!booking.getUser().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Forbidden", "You cannot modify another user's booking.");
        }
        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            return toBookingResponse(booking);
        }
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT || booking.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.CONFLICT, "Booking Expired", "Checkout window has expired.");
        }

        if (booking.getEvent().getSeatingMode() == SeatingMode.STANDING) {
            return confirmStandingPayment(booking, userId, req);
        }

        List<Seat> lockedSeats = seatRepository.findByEventIdAndLockedByAndStatus(
                booking.getEvent().getId(), userId, SeatStatus.LOCKED
        );
        if (lockedSeats.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "Seats Released", "Your locked seats were already released.");
        }

        if (req != null && req.simulateFailure()) {
            booking.setStatus(BookingStatus.FAILED);
            bookingRepository.save(booking);
            releaseSeatsAndNotify(lockedSeats, userId);
            return toBookingResponse(booking);
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentRef("PAY_" + UUID.randomUUID().toString().substring(0, 12).toUpperCase());
        booking = bookingRepository.save(booking);

        Map<UUID, Integer> tierDecrementMap = new HashMap<>();
        List<Ticket> issuedTickets = new ArrayList<>();
        List<UUID> seatIds = new ArrayList<>();

        for (Seat seat : lockedSeats) {
            seat.setStatus(SeatStatus.BOOKED);
            seat.setLockedBy(null);
            seat.setLockedUntil(null);
            seatIds.add(seat.getId());
            tierDecrementMap.merge(seat.getTier().getId(), 1, Integer::sum);

            Ticket ticket = new Ticket();
            ticket.setBooking(booking);
            ticket.setSeat(seat);
            ticket.setTier(seat.getTier());
            ticket.setPassLabel(seat.getRowLabel() + "-" + seat.getSeatNumber());
            ticket.setOwner(booking.getUser());
            UUID qrTokenId = UUID.randomUUID();
            ticket.setQrTokenId(qrTokenId);
            ticket.setQrSignature(signQrPayload(qrTokenId, seat.getId().toString(), booking.getUser().getId()));
            ticket.setStatus(TicketStatus.ACTIVE);
            issuedTickets.add(ticket);
        }

        seatRepository.saveAll(lockedSeats);
        ticketRepository.saveAll(issuedTickets);

        for (var entry : tierDecrementMap.entrySet()) {
            seatTierRepository.findById(entry.getKey()).ifPresent(tier -> {
                tier.setAvailableSeats(Math.max(0, tier.getAvailableSeats() - entry.getValue()));
                seatTierRepository.save(tier);
            });
        }

        redisSeatLockService.releaseSeatLocks(booking.getEvent().getId(), seatIds, userId);
        seatMapBroadcaster.broadcastSeatChange(booking.getEvent().getId(), "SEATS_BOOKED");

        enqueueBookingConfirmed(booking, userId, issuedTickets.size());
        return toBookingResponse(booking, issuedTickets);
    }

    private BookingResponse confirmStandingPayment(Booking booking, UUID userId, ConfirmPaymentRequest req) {
        List<StandingHold> holds = standingHoldRepository.findByBookingId(booking.getId());
        if (holds.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "Hold Expired", "Standing pass hold has expired.");
        }

        if (req != null && req.simulateFailure()) {
            booking.setStatus(BookingStatus.FAILED);
            bookingRepository.save(booking);
            for (StandingHold h : holds) {
                if ("HELD".equals(h.getStatus())) {
                    h.setStatus("RELEASED");
                    SeatTier tier = h.getTier();
                    tier.setAvailableSeats(Math.min(tier.getTotalSeats(), tier.getAvailableSeats() + h.getQuantity()));
                    seatTierRepository.save(tier);
                    redisSeatLockService.releaseStandingPasses(tier.getId(), h.getQuantity());
                }
            }
            standingHoldRepository.saveAll(holds);
            seatMapBroadcaster.broadcastSeatChange(booking.getEvent().getId(), "STANDING_RELEASED");
            return toBookingResponse(booking, List.of());
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setPaymentRef("PAY_" + UUID.randomUUID().toString().substring(0, 12).toUpperCase());
        booking = bookingRepository.save(booking);

        List<Ticket> issuedTickets = new ArrayList<>();
        for (StandingHold hold : holds) {
            hold.setStatus("CONFIRMED");
            for (int i = 0; i < hold.getQuantity(); i++) {
                Ticket ticket = new Ticket();
                ticket.setBooking(booking);
                ticket.setSeat(null);
                ticket.setTier(hold.getTier());
                ticket.setPassLabel(hold.getTier().getName() + " · GA");
                ticket.setOwner(booking.getUser());
                UUID qrTokenId = UUID.randomUUID();
                ticket.setQrTokenId(qrTokenId);
                ticket.setQrSignature(signQrPayload(qrTokenId, hold.getTier().getId().toString(), booking.getUser().getId()));
                ticket.setStatus(TicketStatus.ACTIVE);
                issuedTickets.add(ticket);
            }
        }
        standingHoldRepository.saveAll(holds);
        issuedTickets = ticketRepository.saveAll(issuedTickets);
        seatMapBroadcaster.broadcastSeatChange(booking.getEvent().getId(), "STANDING_BOOKED");

        enqueueBookingConfirmed(booking, userId, issuedTickets.size());
        return toBookingResponse(booking, issuedTickets);
    }

    private void enqueueBookingConfirmed(Booking booking, UUID userId, int count) {
        outboxService.enqueue(
                "BOOKING",
                booking.getId(),
                KafkaTopics.BOOKING_CONFIRMED,
                "BOOKING_CONFIRMED",
                Map.of(
                        "bookingId", booking.getId(),
                        "eventId", booking.getEvent().getId(),
                        "userId", userId,
                        "ticketCount", count,
                        "totalAmountPaise", booking.getTotalAmountPaise()
                )
        );
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getMyTickets(UUID userId) {
        return ticketRepository.findByOwnerIdOrderByIssuedAtDesc(userId).stream()
                .map(this::toTicketResponse)
                .toList();
    }

    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void sweepExpiredLocks() {
        Instant now = Instant.now();

        // 1. Sweep expired assigned-seat locks
        List<Seat> expiredSeats = seatRepository.findByStatusAndLockedUntilBefore(SeatStatus.LOCKED, now);
        if (!expiredSeats.isEmpty()) {
            Map<UUID, List<UUID>> byEvent = new HashMap<>();
            for (Seat seat : expiredSeats) {
                seat.setStatus(SeatStatus.AVAILABLE);
                seat.setLockedBy(null);
                seat.setLockedUntil(null);
                byEvent.computeIfAbsent(seat.getEvent().getId(), k -> new ArrayList<>()).add(seat.getId());
            }
            seatRepository.saveAll(expiredSeats);

            for (var entry : byEvent.entrySet()) {
                outboxService.enqueue(
                        "EVENT",
                        entry.getKey(),
                        KafkaTopics.SEAT_LOCK_EXPIRED,
                        "SEAT_LOCK_EXPIRED",
                        Map.of("eventId", entry.getKey(), "releasedSeatIds", entry.getValue())
                );
                seatMapBroadcaster.broadcastSeatChange(entry.getKey(), "LOCKS_EXPIRED");
            }
            log.info("Swept {} expired seat locks across {} events", expiredSeats.size(), byEvent.size());
        }

        // 2. Sweep expired standing-zone holds
        List<StandingHold> expiredHolds = standingHoldRepository.findByStatusAndExpiresAtBefore("HELD", now);
        if (!expiredHolds.isEmpty()) {
            Set<UUID> touchedEvents = new HashSet<>();
            for (StandingHold hold : expiredHolds) {
                hold.setStatus("RELEASED");
                SeatTier tier = hold.getTier();
                tier.setAvailableSeats(Math.min(tier.getTotalSeats(), tier.getAvailableSeats() + hold.getQuantity()));
                seatTierRepository.save(tier);
                redisSeatLockService.releaseStandingPasses(tier.getId(), hold.getQuantity());
                touchedEvents.add(hold.getEvent().getId());
            }
            standingHoldRepository.saveAll(expiredHolds);
            for (UUID eventId : touchedEvents) {
                seatMapBroadcaster.broadcastSeatChange(eventId, "STANDING_LOCKS_EXPIRED");
            }
            log.info("Swept {} expired standing holds", expiredHolds.size());
        }

        List<Booking> expiredBookings = bookingRepository.findByStatusAndExpiresAtBefore(BookingStatus.PENDING_PAYMENT, now);
        if (!expiredBookings.isEmpty()) {
            for (Booking b : expiredBookings) {
                b.setStatus(BookingStatus.EXPIRED);
            }
            bookingRepository.saveAll(expiredBookings);
        }
    }

    private void releaseSeatsAndNotify(List<Seat> seats, UUID userId) {
        UUID eventId = seats.getFirst().getEvent().getId();
        List<UUID> seatIds = new ArrayList<>();
        for (Seat s : seats) {
            s.setStatus(SeatStatus.AVAILABLE);
            s.setLockedBy(null);
            s.setLockedUntil(null);
            seatIds.add(s.getId());
        }
        seatRepository.saveAll(seats);
        redisSeatLockService.releaseSeatLocks(eventId, seatIds, userId);
        seatMapBroadcaster.broadcastSeatChange(eventId, "SEATS_RELEASED");
        outboxService.enqueue(
                "EVENT",
                eventId,
                KafkaTopics.SEAT_LOCK_EXPIRED,
                "SEAT_LOCK_EXPIRED",
                Map.of("eventId", eventId, "releasedSeatIds", seatIds)
        );
    }

    private String signQrPayload(UUID qrTokenId, String resourceId, UUID ownerId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(qrSigningSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal((qrTokenId + ":" + resourceId + ":" + ownerId).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to sign QR payload", ex);
        }
    }

    private BookingResponse toBookingResponse(Booking b) {
        return toBookingResponse(b, ticketRepository.findByBookingId(b.getId()));
    }

    private BookingResponse toBookingResponse(Booking b, List<Ticket> ticketEntities) {
        List<TicketResponse> tickets = ticketEntities.stream()
                .map(this::toTicketResponse)
                .toList();
        return new BookingResponse(
                b.getId(),
                b.getEvent().getId(),
                b.getEvent().getTitle(),
                b.getIdempotencyKey(),
                b.getTotalAmountPaise() - b.getPlatformFeePaise(),
                b.getPlatformFeePaise(),
                b.getTotalAmountPaise(),
                b.getStatus(),
                b.getPaymentRef(),
                b.getExpiresAt(),
                b.getCreatedAt(),
                tickets
        );
    }

    private TicketResponse toTicketResponse(Ticket t) {
        Event ev = t.getBooking().getEvent();
        Seat seat = t.getSeat();
        SeatTier tier = t.getTier() != null ? t.getTier() : (seat != null ? seat.getTier() : null);
        String label = t.getPassLabel() != null
                ? t.getPassLabel()
                : (seat != null ? seat.getRowLabel() + "-" + seat.getSeatNumber() : "GA PASS");

        return new TicketResponse(
                t.getId(),
                t.getBooking().getId(),
                ev.getId(),
                ev.getTitle(),
                ev.getVenueName(),
                ev.getCity(),
                ev.getEventStartAt(),
                tier != null ? tier.getName() : "General",
                seat != null ? seat.getRowLabel() : null,
                seat != null ? seat.getSeatNumber() : null,
                label,
                tier != null ? tier.getBasePricePaise() : 0L,
                t.getQrTokenId(),
                t.getQrSignature(),
                t.getStatus(),
                t.getIssuedAt()
        );
    }
}
