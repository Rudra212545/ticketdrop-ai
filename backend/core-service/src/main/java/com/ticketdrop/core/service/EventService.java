package com.ticketdrop.core.service;

import com.ticketdrop.core.audit.Audited;
import com.ticketdrop.core.domain.entity.*;
import com.ticketdrop.core.domain.enums.*;
import com.ticketdrop.core.dto.EventDtos.*;
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

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EventService {

    private static final Logger log = LoggerFactory.getLogger(EventService.class);

    private final EventRepository eventRepository;
    private final SeatTierRepository seatTierRepository;
    private final SeatRepository seatRepository;
    private final OrganizerProfileRepository organizerProfileRepository;
    private final BookingRepository bookingRepository;
    private final TicketRepository ticketRepository;
    private final ResaleListingRepository resaleListingRepository;
    private final OutboxService outboxService;
    private final RedisSeatLockService redisSeatLockService;
    private final StringRedisTemplate redisTemplate;

    public EventService(
            EventRepository eventRepository,
            SeatTierRepository seatTierRepository,
            SeatRepository seatRepository,
            OrganizerProfileRepository organizerProfileRepository,
            BookingRepository bookingRepository,
            TicketRepository ticketRepository,
            ResaleListingRepository resaleListingRepository,
            OutboxService outboxService,
            RedisSeatLockService redisSeatLockService,
            StringRedisTemplate redisTemplate
    ) {
        this.eventRepository = eventRepository;
        this.seatTierRepository = seatTierRepository;
        this.seatRepository = seatRepository;
        this.organizerProfileRepository = organizerProfileRepository;
        this.bookingRepository = bookingRepository;
        this.ticketRepository = ticketRepository;
        this.resaleListingRepository = resaleListingRepository;
        this.outboxService = outboxService;
        this.redisSeatLockService = redisSeatLockService;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    @Audited(action = "EVENT_CREATED", resourceType = "EVENT")
    public EventSummary createEvent(UUID organizerUserId, CreateEventRequest req) {
        OrganizerProfile organizer = requireApprovedOrganizer(organizerUserId);

        Event event = new Event();
        event.setOrganizer(organizer);
        event.setTitle(req.title().trim());
        event.setDescription(req.description().trim());
        event.setCategory(req.category().trim().toUpperCase());
        event.setCity(req.city().trim());
        event.setVenueName(req.venueName().trim());
        event.setEventStartAt(req.eventStartAt());
        SeatingMode mode = req.seatingMode() != null ? req.seatingMode() : SeatingMode.ASSIGNED_SEAT;
        event.setSeatingMode(mode);
        event.setFlashSaleEnabled(req.flashSaleEnabled());
        event.setFlashSaleStartAt(req.flashSaleStartAt());
        event.setResaleEnabled(req.resaleEnabled());
        event.setMaxResaleMultiplier(
                req.maxResaleMultiplier() != null ? req.maxResaleMultiplier() : new BigDecimal("1.10")
        );
        event.setStatus(EventStatus.DRAFT);
        event = eventRepository.save(event);

        String[] defaultColors = {"VIOLET", "EMERALD", "SKY", "CYAN", "FUCHSIA"};
        List<Seat> allSeats = new ArrayList<>();
        int tierIdx = 0;
        for (TierSpec spec : req.tiers()) {
            String color = (spec.colorCode() != null && !spec.colorCode().isBlank())
                    ? spec.colorCode().trim().toUpperCase()
                    : defaultColors[tierIdx % defaultColors.length];
            tierIdx++;

            if (mode == SeatingMode.STANDING) {
                int capacity = spec.capacity() != null && spec.capacity() > 0 ? spec.capacity() : 100;
                SeatTier tier = new SeatTier();
                tier.setEvent(event);
                tier.setName(spec.name().trim());
                tier.setBasePricePaise(spec.basePricePaise());
                tier.setColorCode(color);
                tier.setTotalSeats(capacity);
                tier.setAvailableSeats(capacity);
                tier = seatTierRepository.save(tier);
                redisSeatLockService.seedStandingAvailability(tier.getId(), capacity);
            } else {
                int rowCount = spec.rowCount() != null && spec.rowCount() > 0 ? spec.rowCount() : 2;
                int seatsPerRow = spec.seatsPerRow() != null && spec.seatsPerRow() > 0 ? spec.seatsPerRow() : 8;
                String rowPrefix = (spec.rowPrefix() != null && !spec.rowPrefix().isBlank())
                        ? spec.rowPrefix().trim().toUpperCase()
                        : "R";
                int tierTotal = rowCount * seatsPerRow;

                SeatTier tier = new SeatTier();
                tier.setEvent(event);
                tier.setName(spec.name().trim());
                tier.setBasePricePaise(spec.basePricePaise());
                tier.setColorCode(color);
                tier.setTotalSeats(tierTotal);
                tier.setAvailableSeats(tierTotal);
                tier = seatTierRepository.save(tier);

                for (int r = 1; r <= rowCount; r++) {
                    String rowLabel = rowPrefix + r;
                    for (int s = 1; s <= seatsPerRow; s++) {
                        Seat seat = new Seat();
                        seat.setEvent(event);
                        seat.setTier(tier);
                        seat.setRowLabel(rowLabel);
                        seat.setSeatNumber(s);
                        seat.setStatus(SeatStatus.AVAILABLE);
                        allSeats.add(seat);
                    }
                }
            }
        }
        if (!allSeats.isEmpty()) {
            seatRepository.saveAll(allSeats);
        }

        return toEventSummary(event);
    }

    @Transactional
    @Audited(action = "EVENT_UPDATED", resourceType = "EVENT")
    public EventSummary updateEvent(UUID eventId, UUID organizerUserId, UpdateEventRequest req) {
        OrganizerProfile organizer = requireApprovedOrganizer(organizerUserId);
        Event event = eventRepository.findWithOrganizerById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));

        if (!event.getOrganizer().getId().equals(organizer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not Event Owner", "You can only edit your own events.");
        }
        if (event.getStatus() == EventStatus.COMPLETED || event.getStatus() == EventStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "Event Locked", "Completed or cancelled events cannot be edited.");
        }
        if (event.getStatus() == EventStatus.CANCELLED) {
            throw new ApiException(HttpStatus.CONFLICT, "Event Cancelled", "Cancelled events cannot be edited.");
        }

        event.setTitle(req.title().trim());
        event.setDescription(req.description().trim());
        event.setCategory(req.category().trim().toUpperCase());
        event.setCity(req.city().trim());
        event.setVenueName(req.venueName().trim());
        event.setEventStartAt(req.eventStartAt());
        event.setFlashSaleEnabled(req.flashSaleEnabled());
        event.setResaleEnabled(req.resaleEnabled());
        if (req.maxResaleMultiplier() != null) {
            event.setMaxResaleMultiplier(req.maxResaleMultiplier());
        }

        event = eventRepository.save(event);
        return toEventSummary(event);
    }

    @Transactional
    @Audited(action = "EVENT_PUBLISHED", resourceType = "EVENT")
    public EventSummary publishEvent(UUID eventId, UUID organizerUserId) {
        OrganizerProfile organizer = requireApprovedOrganizer(organizerUserId);
        Event event = eventRepository.findWithOrganizerById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));

        if (!event.getOrganizer().getId().equals(organizer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not Event Owner", "You can only publish your own events.");
        }
        if (event.getStatus() == EventStatus.PUBLISHED) {
            return toEventSummary(event);
        }

        event.setStatus(EventStatus.PUBLISHED);
        event = eventRepository.save(event);

        outboxService.enqueue(
                "EVENT",
                event.getId(),
                KafkaTopics.EVENT_PUBLISHED,
                "EVENT_PUBLISHED",
                Map.of(
                        "eventId", event.getId(),
                        "title", event.getTitle(),
                        "description", event.getDescription(),
                        "category", event.getCategory(),
                        "city", event.getCity(),
                        "venueName", event.getVenueName(),
                        "eventStartAt", event.getEventStartAt().toString()
                )
        );
        return toEventSummary(event);
    }

    /**
     * Hard-delete is ONLY permitted for DRAFT events or events with 0 bookings/tickets.
     * Live events with sold tickets must be CANCELLED to preserve financial & audit history.
     */
    @Transactional
    @Audited(action = "EVENT_DELETED", resourceType = "EVENT")
    public void deleteEvent(UUID eventId, UUID organizerUserId) {
        OrganizerProfile organizer = requireApprovedOrganizer(organizerUserId);
        Event event = eventRepository.findWithOrganizerById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));
        if (!event.getOrganizer().getId().equals(organizer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not Event Owner", "You can only delete your own events.");
        }
        long bookingsCount = bookingRepository.countByEventId(eventId);
        long ticketsCount = ticketRepository.countByBookingEventId(eventId);
        if (bookingsCount > 0 || ticketsCount > 0) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Cannot Delete Event With Bookings",
                    "This event already has fan bookings. Use Cancel Event instead so passes are revoked and refunded cleanly."
            );
        }
        eventRepository.delete(event);
    }

    /**
     * Cancels a live event: transitions status -> CANCELLED, marks confirmed bookings REFUNDED,
     * revokes active QR passes (and caches revocation in Redis), cancels open resale listings,
     * and enqueues event.cancelled in the Outbox.
     */
    @Transactional
    @Audited(action = "EVENT_CANCELLED", resourceType = "EVENT")
    public EventSummary cancelEvent(UUID eventId, UUID organizerUserId) {
        OrganizerProfile organizer = requireApprovedOrganizer(organizerUserId);
        Event event = eventRepository.findWithOrganizerById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));
        if (!event.getOrganizer().getId().equals(organizer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not Event Owner", "You can only cancel your own events.");
        }
        if (event.getStatus() == EventStatus.CANCELLED) {
            return toEventSummary(event);
        }
        if (event.getStatus() == EventStatus.COMPLETED) {
            throw new ApiException(HttpStatus.CONFLICT, "Already Completed", "Completed events cannot be cancelled.");
        }

        event.setStatus(EventStatus.CANCELLED);
        event = eventRepository.save(event);

        List<Booking> bookings = bookingRepository.findByEventIdAndStatusIn(
                eventId, List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT)
        );
        int refundedCount = 0;
        for (Booking b : bookings) {
            if (b.getStatus() == BookingStatus.CONFIRMED) {
                b.setStatus(BookingStatus.REFUNDED);
                refundedCount++;
            } else {
                b.setStatus(BookingStatus.EXPIRED);
            }
        }
        bookingRepository.saveAll(bookings);

        List<Ticket> activeTickets = ticketRepository.findByBookingEventIdAndStatusIn(
                eventId, List.of(TicketStatus.ACTIVE, TicketStatus.RESALE_LISTED)
        );
        for (Ticket t : activeTickets) {
            t.setStatus(TicketStatus.REVOKED);
            redisTemplate.opsForValue().set("qr:revoked:" + t.getQrTokenId(), "EVENT_CANCELLED", Duration.ofDays(30));
        }
        ticketRepository.saveAll(activeTickets);

        List<ResaleListing> openListings = resaleListingRepository.findByEventIdAndStatusOrderByAskingPricePaiseAsc(
                eventId, ResaleStatus.ACTIVE
        );
        for (ResaleListing rl : openListings) {
            rl.setStatus(ResaleStatus.CANCELLED);
        }
        resaleListingRepository.saveAll(openListings);

        outboxService.enqueue(
                "EVENT",
                event.getId(),
                KafkaTopics.EVENT_CANCELLED,
                "EVENT_CANCELLED",
                Map.of(
                        "eventId", event.getId(),
                        "title", event.getTitle(),
                        "refundedBookings", refundedCount,
                        "revokedTickets", activeTickets.size()
                )
        );
        return toEventSummary(event);
    }

    @Transactional
    @Audited(action = "EVENT_COMPLETED", resourceType = "EVENT")
    public EventSummary completeEvent(UUID eventId, UUID organizerUserId) {
        OrganizerProfile organizer = requireApprovedOrganizer(organizerUserId);
        Event event = eventRepository.findWithOrganizerById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));
        if (!event.getOrganizer().getId().equals(organizer.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not Event Owner", "You can only complete your own events.");
        }
        event.setStatus(EventStatus.COMPLETED);
        event = eventRepository.save(event);

        List<ResaleListing> openListings = resaleListingRepository.findByEventIdAndStatusOrderByAskingPricePaiseAsc(
                eventId, ResaleStatus.ACTIVE
        );
        for (ResaleListing rl : openListings) {
            rl.setStatus(ResaleStatus.CANCELLED);
        }
        resaleListingRepository.saveAll(openListings);
        return toEventSummary(event);
    }

    /**
     * Automatically marks PUBLISHED / SOLD_OUT events as COMPLETED 4 hours after eventStartAt.
     */
    @Scheduled(fixedDelay = 900_000)
    @Transactional
    public void autoCompletePastEvents() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(4));
        List<Event> past = eventRepository.findByStatusInAndEventStartAtBefore(
                List.of(EventStatus.PUBLISHED, EventStatus.SOLD_OUT), cutoff
        );
        if (past.isEmpty()) return;
        for (Event ev : past) {
            ev.setStatus(EventStatus.COMPLETED);
            List<ResaleListing> openListings = resaleListingRepository.findByEventIdAndStatusOrderByAskingPricePaiseAsc(
                    ev.getId(), ResaleStatus.ACTIVE
            );
            for (ResaleListing rl : openListings) {
                rl.setStatus(ResaleStatus.CANCELLED);
            }
            resaleListingRepository.saveAll(openListings);
        }
        eventRepository.saveAll(past);
        log.info("Auto-completed {} past events", past.size());
    }

    @Transactional(readOnly = true)
    public List<EventSummary> listOrganizerEvents(UUID organizerUserId) {
        OrganizerProfile organizer = organizerProfileRepository.findByUserId(organizerUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Organizer Not Found", "Organizer profile not found."));
        return eventRepository.findByOrganizerIdOrderByCreatedAtDesc(organizer.getId()).stream()
                .map(this::toEventSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EventSummary> listPublishedEvents(String city, String category) {
        return eventRepository.findByStatusOrderByEventStartAtAsc(EventStatus.PUBLISHED).stream()
                .filter(e -> city == null || city.isBlank() || e.getCity().equalsIgnoreCase(city.trim()))
                .filter(e -> category == null || category.isBlank() || e.getCategory().equalsIgnoreCase(category.trim()))
                .map(this::toEventSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public SeatMapResponse getSeatMap(UUID eventId, UUID currentUserId) {
        Event event = eventRepository.findWithOrganizerById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));
        List<Seat> seats = seatRepository.findByEventIdOrderByRowLabelAscSeatNumberAsc(eventId);
        Instant now = Instant.now();

        List<SeatDto> seatDtos = seats.stream().map(s -> {
            SeatStatus effectiveStatus = s.getStatus();
            boolean lockedByMe = false;
            Instant lockedUntil = s.getLockedUntil();

            if (effectiveStatus == SeatStatus.LOCKED && lockedUntil != null && lockedUntil.isBefore(now)) {
                effectiveStatus = SeatStatus.AVAILABLE;
                lockedUntil = null;
            } else if (effectiveStatus == SeatStatus.LOCKED && currentUserId != null && currentUserId.equals(s.getLockedBy())) {
                lockedByMe = true;
            }

            return new SeatDto(
                    s.getId(),
                    s.getTier().getId(),
                    s.getTier().getName(),
                    s.getTier().getBasePricePaise(),
                    s.getRowLabel(),
                    s.getSeatNumber(),
                    effectiveStatus,
                    lockedByMe,
                    lockedUntil
            );
        }).toList();

        return new SeatMapResponse(toEventSummary(event), seatDtos);
    }

    public QueueStatusResponse joinWaitingRoom(UUID eventId, UUID userId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event Not Found", "Event does not exist."));
        if (!event.isFlashSaleEnabled()) {
            return new QueueStatusResponse(eventId, true, 0, 0, "DIRECT_ACCESS");
        }
        var state = redisSeatLockService.joinOrCheckWaitingRoom(eventId, userId);
        return new QueueStatusResponse(eventId, state.admitted(), state.position(), state.totalInQueue(), state.admissionToken());
    }

    private OrganizerProfile requireApprovedOrganizer(UUID userId) {
        OrganizerProfile organizer = organizerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Organizer Not Found", "Organizer profile not found."));
        if (organizer.getApprovalStatus() != ApprovalStatus.APPROVED) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Organizer Not Approved",
                    "Your organization must be APPROVED by a Platform Super Admin before creating or publishing events."
            );
        }
        return organizer;
    }

    public EventSummary toEventSummary(Event event) {
        List<SeatTier> tiers = seatTierRepository.findByEventIdOrderByBasePricePaiseDesc(event.getId());
        List<TierSummary> tierDtos = tiers.stream()
                .map(t -> new TierSummary(
                        t.getId(),
                        t.getName(),
                        t.getBasePricePaise(),
                        t.getColorCode(),
                        t.getTotalSeats(),
                        t.getAvailableSeats()
                ))
                .toList();
        long minPrice = tiers.stream().mapToLong(SeatTier::getBasePricePaise).min().orElse(0L);
        int totalSeats = tiers.stream().mapToInt(SeatTier::getTotalSeats).sum();
        int availableSeats = tiers.stream().mapToInt(SeatTier::getAvailableSeats).sum();

        return new EventSummary(
                event.getId(),
                event.getOrganizer().getId(),
                event.getOrganizer().getOrgName(),
                event.getTitle(),
                event.getDescription(),
                event.getCategory(),
                event.getCity(),
                event.getVenueName(),
                event.getEventStartAt(),
                event.getSeatingMode(),
                event.isFlashSaleEnabled(),
                event.isResaleEnabled(),
                event.getMaxResaleMultiplier(),
                event.getStatus(),
                minPrice,
                totalSeats,
                availableSeats,
                tierDtos,
                event.getCreatedAt()
        );
    }
}

