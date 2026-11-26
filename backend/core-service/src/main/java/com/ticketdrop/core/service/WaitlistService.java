package com.ticketdrop.core.service;

import com.ticketdrop.core.domain.entity.*;
import com.ticketdrop.core.domain.enums.BookingStatus;
import com.ticketdrop.core.domain.enums.EventStatus;
import com.ticketdrop.core.domain.enums.SeatStatus;
import com.ticketdrop.core.domain.enums.SeatingMode;
import com.ticketdrop.core.domain.enums.WaitlistStatus;
import com.ticketdrop.core.dto.BookingDtos.BookingResponse;
import com.ticketdrop.core.dto.Phase3Dtos.WaitlistEntryResponse;
import com.ticketdrop.core.exception.ApiException;
import com.ticketdrop.core.repository.*;
import com.ticketdrop.events.KafkaTopics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class WaitlistService {

    private static final Logger log = LoggerFactory.getLogger(WaitlistService.class);
    public static final Duration OFFER_TTL = Duration.ofMinutes(5);

    private final WaitlistEntryRepository waitlistRepository;
    private final EventRepository eventRepository;
    private final SeatTierRepository seatTierRepository;
    private final SeatRepository seatRepository;
    private final StandingHoldRepository standingHoldRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final RedisSeatLockService redisSeatLockService;
    private final SeatMapBroadcaster seatMapBroadcaster;
    private final OutboxService outboxService;
    private final StringRedisTemplate redisTemplate;

    public WaitlistService(
            WaitlistEntryRepository waitlistRepository,
            EventRepository eventRepository,
            SeatTierRepository seatTierRepository,
            SeatRepository seatRepository,
            StandingHoldRepository standingHoldRepository,
            UserRepository userRepository,
            BookingRepository bookingRepository,
            RedisSeatLockService redisSeatLockService,
            SeatMapBroadcaster seatMapBroadcaster,
            OutboxService outboxService,
            StringRedisTemplate redisTemplate
    ) {
        this.waitlistRepository = waitlistRepository;
        this.eventRepository = eventRepository;
        this.seatTierRepository = seatTierRepository;
        this.seatRepository = seatRepository;
        this.standingHoldRepository = standingHoldRepository;
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
        this.redisSeatLockService = redisSeatLockService;
        this.seatMapBroadcaster = seatMapBroadcaster;
        this.outboxService = outboxService;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    public WaitlistEntryResponse joinWaitlist(UUID userId, UUID eventId, UUID tierId) {
        Event event = eventRepository.findWithOrganizerById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));
        if (event.getStatus() != EventStatus.PUBLISHED && event.getStatus() != EventStatus.SOLD_OUT) {
            throw new ApiException(HttpStatus.CONFLICT, "Event Closed", "Waitlist is only open for live events.");
        }
        SeatTier tier = seatTierRepository.findById(tierId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tier Not Found", "Tier does not exist."));
        if (!tier.getEvent().getId().equals(eventId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid Tier", "Tier does not belong to this event.");
        }

        boolean alreadyIn = waitlistRepository.existsByEventIdAndTierIdAndUserIdAndStatusIn(
                eventId, tierId, userId, List.of(WaitlistStatus.WAITING, WaitlistStatus.OFFERED)
        );
        if (alreadyIn) {
            throw new ApiException(HttpStatus.CONFLICT, "Already Waitlisted", "You are already on the waitlist for this tier.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User Not Found", "User not found."));

        WaitlistEntry entry = new WaitlistEntry();
        entry.setEvent(event);
        entry.setTier(tier);
        entry.setUser(user);
        entry.setStatus(WaitlistStatus.WAITING);
        entry = waitlistRepository.save(entry);

        String zsetKey = waitlistRedisKey(eventId, tierId);
        redisTemplate.opsForZSet().add(zsetKey, entry.getId().toString(), System.currentTimeMillis());

        return toResponse(entry);
    }

    @Transactional(readOnly = true)
    public List<WaitlistEntryResponse> getMyWaitlist(UUID userId) {
        return waitlistRepository.findByUserIdAndStatusInOrderByCreatedAtDesc(
                userId, List.of(WaitlistStatus.WAITING, WaitlistStatus.OFFERED)
        ).stream().map(this::toResponse).toList();
    }

    @Transactional
    public void leaveWaitlist(UUID entryId, UUID userId) {
        WaitlistEntry entry = waitlistRepository.findById(entryId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Waitlist Entry Not Found", "Entry does not exist."));
        if (!entry.getUser().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Forbidden", "You cannot modify another user's waitlist entry.");
        }
        if (entry.getStatus() == WaitlistStatus.OFFERED) {
            if (entry.getOfferedSeat() != null) {
                Seat seat = entry.getOfferedSeat();
                seat.setStatus(SeatStatus.AVAILABLE);
                seat.setLockedBy(null);
                seat.setLockedUntil(null);
                seatRepository.save(seat);
                redisSeatLockService.releaseSeatLocks(entry.getEvent().getId(), List.of(seat.getId()), userId);
                seatMapBroadcaster.broadcastSeatChange(entry.getEvent().getId(), "WAITLIST_OFFER_RELEASED");
            } else if (entry.getEvent().getSeatingMode() == SeatingMode.STANDING) {
                releaseStandingOfferHold(entry);
            }
        }
        entry.setStatus(WaitlistStatus.CANCELLED);
        waitlistRepository.save(entry);
        redisTemplate.opsForZSet().remove(waitlistRedisKey(entry.getEvent().getId(), entry.getTier().getId()), entry.getId().toString());
    }

    /**
     * Triggered automatically when locked seats expire or are cancelled.
     * Offers each released seat to the next FIFO waiting fan in that tier with a 5-min exclusive lock!
     */
    @Transactional
    public int offerReleasedSeats(UUID eventId, List<UUID> releasedSeatIds) {
        if (releasedSeatIds == null || releasedSeatIds.isEmpty()) return 0;
        List<Seat> seats = seatRepository.findByIdInAndEventId(releasedSeatIds, eventId);
        int offeredCount = 0;

        for (Seat seat : seats) {
            if (seat.getStatus() != SeatStatus.AVAILABLE) continue;
            Optional<WaitlistEntry> nextOpt = waitlistRepository
                    .findFirstByEventIdAndTierIdAndStatusOrderByCreatedAtAsc(
                            eventId, seat.getTier().getId(), WaitlistStatus.WAITING
                    );
            if (nextOpt.isEmpty()) continue;

            WaitlistEntry next = nextOpt.get();
            Instant expiresAt = Instant.now().plus(OFFER_TTL);
            String lockToken = redisSeatLockService.tryAcquireSeatLocks(eventId, List.of(seat.getId()), next.getUser().getId());
            if (lockToken == null) continue;

            seat.setStatus(SeatStatus.LOCKED);
            seat.setLockedBy(next.getUser().getId());
            seat.setLockedUntil(expiresAt);
            seatRepository.save(seat);

            next.setStatus(WaitlistStatus.OFFERED);
            next.setOfferedSeat(seat);
            next.setOfferExpiresAt(expiresAt);
            waitlistRepository.save(next);

            redisTemplate.opsForZSet().remove(waitlistRedisKey(eventId, seat.getTier().getId()), next.getId().toString());

            outboxService.enqueue(
                    "WAITLIST",
                    next.getId(),
                    KafkaTopics.WAITLIST_SEAT_OFFERED,
                    "WAITLIST_SEAT_OFFERED",
                    Map.of(
                            "waitlistEntryId", next.getId(),
                            "eventId", eventId,
                            "userId", next.getUser().getId(),
                            "seatId", seat.getId(),
                            "seatLabel", seat.getRowLabel() + "-" + seat.getSeatNumber(),
                            "offerExpiresAt", expiresAt.toString()
                    )
            );
            offeredCount++;
        }

        if (offeredCount > 0) {
            seatMapBroadcaster.broadcastSeatChange(eventId, "WAITLIST_OFFERED");
            log.info("Auto-offered {} released seat(s) to waitlisted fans for event {}", offeredCount, eventId);
        }
        return offeredCount;
    }

    /**
     * Triggered automatically when Open-Ground Standing passes are cancelled or expire.
     * Reserves up to `quantity` standing passes (1 per FIFO waitlisted fan) with a 5-min exclusive hold!
     */
    @Transactional
    public int offerReleasedStandingPasses(UUID eventId, UUID tierId, int quantity) {
        if (quantity <= 0) return 0;
        SeatTier tier = seatTierRepository.findById(tierId).orElse(null);
        if (tier == null || tier.getAvailableSeats() <= 0) return 0;

        int offeredCount = 0;
        for (int i = 0; i < quantity; i++) {
            if (tier.getAvailableSeats() <= 0) break;
            Optional<WaitlistEntry> nextOpt = waitlistRepository
                    .findFirstByEventIdAndTierIdAndStatusOrderByCreatedAtAsc(
                            eventId, tierId, WaitlistStatus.WAITING
                    );
            if (nextOpt.isEmpty()) break;

            boolean reserved = redisSeatLockService.tryReserveStandingPasses(tierId, tier.getAvailableSeats(), 1);
            if (!reserved) break;

            WaitlistEntry next = nextOpt.get();
            Instant expiresAt = Instant.now().plus(OFFER_TTL);

            tier.setAvailableSeats(tier.getAvailableSeats() - 1);
            seatTierRepository.save(tier);

            StandingHold hold = new StandingHold();
            hold.setEvent(next.getEvent());
            hold.setTier(tier);
            hold.setUser(next.getUser());
            hold.setBookingId(null);
            hold.setQuantity(1);
            hold.setStatus("HELD");
            hold.setExpiresAt(expiresAt);
            standingHoldRepository.save(hold);

            next.setStatus(WaitlistStatus.OFFERED);
            next.setOfferedSeat(null);
            next.setOfferExpiresAt(expiresAt);
            waitlistRepository.save(next);

            redisTemplate.opsForZSet().remove(waitlistRedisKey(eventId, tierId), next.getId().toString());

            outboxService.enqueue(
                    "WAITLIST",
                    next.getId(),
                    KafkaTopics.WAITLIST_SEAT_OFFERED,
                    "WAITLIST_SEAT_OFFERED",
                    Map.of(
                            "waitlistEntryId", next.getId(),
                            "eventId", eventId,
                            "userId", next.getUser().getId(),
                            "tierId", tierId,
                            "passLabel", tier.getName() + " · GA",
                            "offerExpiresAt", expiresAt.toString()
                    )
            );
            offeredCount++;
        }

        if (offeredCount > 0) {
            seatMapBroadcaster.broadcastSeatChange(eventId, "WAITLIST_OFFERED");
            log.info("Auto-offered {} standing pass(es) to waitlisted fans for event {}", offeredCount, eventId);
        }
        return offeredCount;
    }

    /**
     * Fan claims their 5-minute waitlist offer (Assigned Seat OR Standing Zone Pass) ->
     * creates an immediate PENDING_PAYMENT booking so they can pay right away.
     */
    @Transactional
    public BookingResponse claimOffer(UUID entryId, UUID userId) {
        WaitlistEntry entry = waitlistRepository.findById(entryId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Waitlist Offer Not Found", "Offer does not exist."));
        if (!entry.getUser().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Forbidden", "This offer belongs to another fan.");
        }
        if (entry.getStatus() != WaitlistStatus.OFFERED) {
            throw new ApiException(HttpStatus.CONFLICT, "Offer Not Active", "This waitlist offer is no longer active.");
        }
        if (entry.getOfferExpiresAt() != null && entry.getOfferExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.CONFLICT, "Offer Expired", "Your 5-minute claim window has expired.");
        }

        Event event = eventRepository.findWithOrganizerById(entry.getEvent().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));

        boolean isStanding = event.getSeatingMode() == SeatingMode.STANDING;
        if (!isStanding && entry.getOfferedSeat() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "Offer Not Active", "Offered seat is no longer attached.");
        }

        Instant expiresAt = entry.getOfferExpiresAt();
        long subtotal = isStanding
                ? entry.getTier().getBasePricePaise()
                : entry.getOfferedSeat().getTier().getBasePricePaise();
        int feeBps = event.getOrganizer().getPlatformFeeBps();
        long platformFee = (subtotal * feeBps) / 10_000L;

        Booking booking = new Booking();
        booking.setUser(entry.getUser());
        booking.setEvent(event);
        booking.setIdempotencyKey("waitlist-" + entry.getId());
        booking.setPlatformFeePaise(platformFee);
        booking.setTotalAmountPaise(subtotal + platformFee);
        booking.setStatus(BookingStatus.PENDING_PAYMENT);
        booking.setExpiresAt(expiresAt);
        booking = bookingRepository.save(booking);

        if (isStanding) {
            StandingHold hold = standingHoldRepository
                    .findFirstByEventIdAndTierIdAndUserIdAndStatusAndBookingIdIsNullOrderByCreatedAtDesc(
                            event.getId(), entry.getTier().getId(), userId, "HELD"
                    )
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "Hold Expired", "Your standing pass hold expired."));
            hold.setBookingId(booking.getId());
            standingHoldRepository.save(hold);
        }

        entry.setStatus(WaitlistStatus.CLAIMED);
        waitlistRepository.save(entry);

        return new BookingResponse(
                booking.getId(),
                event.getId(),
                event.getTitle(),
                booking.getIdempotencyKey(),
                subtotal,
                platformFee,
                booking.getTotalAmountPaise(),
                booking.getStatus(),
                booking.getPaymentRef(),
                booking.getExpiresAt(),
                booking.getCreatedAt(),
                List.of()
        );
    }

    /**
     * Sweeps expired 5-minute waitlist offers (both Seated & Standing) and cascades to the next FIFO fan.
     */
    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void sweepExpiredOffers() {
        List<WaitlistEntry> expired = waitlistRepository.findByStatusAndOfferExpiresAtBefore(
                WaitlistStatus.OFFERED, Instant.now()
        );
        if (expired.isEmpty()) return;

        for (WaitlistEntry entry : expired) {
            entry.setStatus(WaitlistStatus.EXPIRED);
            waitlistRepository.save(entry);

            if (entry.getEvent().getSeatingMode() == SeatingMode.STANDING) {
                if (releaseStandingOfferHold(entry)) {
                    offerReleasedStandingPasses(entry.getEvent().getId(), entry.getTier().getId(), 1);
                }
            } else {
                Seat seat = entry.getOfferedSeat();
                if (seat != null && seat.getStatus() == SeatStatus.LOCKED && entry.getUser().getId().equals(seat.getLockedBy())) {
                    seat.setStatus(SeatStatus.AVAILABLE);
                    seat.setLockedBy(null);
                    seat.setLockedUntil(null);
                    seatRepository.save(seat);
                    redisSeatLockService.releaseSeatLocks(entry.getEvent().getId(), List.of(seat.getId()), entry.getUser().getId());
                    offerReleasedSeats(entry.getEvent().getId(), List.of(seat.getId()));
                }
            }
        }
        log.info("Swept {} expired waitlist offer(s)", expired.size());
    }

    private boolean releaseStandingOfferHold(WaitlistEntry entry) {
        var holdOpt = standingHoldRepository
                .findFirstByEventIdAndTierIdAndUserIdAndStatusAndBookingIdIsNullOrderByCreatedAtDesc(
                        entry.getEvent().getId(), entry.getTier().getId(), entry.getUser().getId(), "HELD"
                );
        if (holdOpt.isEmpty()) return false;
        StandingHold hold = holdOpt.get();
        hold.setStatus("RELEASED");
        standingHoldRepository.save(hold);

        SeatTier tier = hold.getTier();
        tier.setAvailableSeats(Math.min(tier.getTotalSeats(), tier.getAvailableSeats() + hold.getQuantity()));
        seatTierRepository.save(tier);
        redisSeatLockService.releaseStandingPasses(tier.getId(), hold.getQuantity());
        seatMapBroadcaster.broadcastSeatChange(entry.getEvent().getId(), "WAITLIST_OFFER_RELEASED");
        return true;
    }

    private String waitlistRedisKey(UUID eventId, UUID tierId) {
        return "waitlist:" + eventId + ":" + tierId;
    }

    private WaitlistEntryResponse toResponse(WaitlistEntry e) {
        Long rank = redisTemplate.opsForZSet().rank(
                waitlistRedisKey(e.getEvent().getId(), e.getTier().getId()), e.getId().toString()
        );
        long pos = e.getStatus() == WaitlistStatus.OFFERED ? 1L : (rank != null ? rank + 1 : 1L);
        Seat s = e.getOfferedSeat();
        String offeredLabel = s != null
                ? s.getRowLabel() + "-" + s.getSeatNumber()
                : (e.getStatus() == WaitlistStatus.OFFERED ? e.getTier().getName() + " · GA Pass" : null);
        return new WaitlistEntryResponse(
                e.getId(),
                e.getEvent().getId(),
                e.getEvent().getTitle(),
                e.getEvent().getVenueName(),
                e.getEvent().getCity(),
                e.getTier().getId(),
                e.getTier().getName(),
                e.getTier().getBasePricePaise(),
                e.getStatus(),
                s != null ? s.getId() : null,
                offeredLabel,
                e.getOfferExpiresAt(),
                pos,
                e.getCreatedAt()
        );
    }
}

