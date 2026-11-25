package com.ticketdrop.core.service;

import com.ticketdrop.core.audit.Audited;
import com.ticketdrop.core.domain.entity.Event;
import com.ticketdrop.core.domain.entity.OrganizerProfile;
import com.ticketdrop.core.domain.entity.Seat;
import com.ticketdrop.core.domain.entity.SeatTier;
import com.ticketdrop.core.domain.enums.ApprovalStatus;
import com.ticketdrop.core.domain.enums.EventStatus;
import com.ticketdrop.core.domain.enums.SeatStatus;
import com.ticketdrop.core.domain.enums.SeatingMode;
import com.ticketdrop.core.dto.EventDtos.*;
import com.ticketdrop.core.exception.ApiException;
import com.ticketdrop.core.repository.EventRepository;
import com.ticketdrop.core.repository.OrganizerProfileRepository;
import com.ticketdrop.core.repository.SeatRepository;
import com.ticketdrop.core.repository.SeatTierRepository;
import com.ticketdrop.events.KafkaTopics;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final SeatTierRepository seatTierRepository;
    private final SeatRepository seatRepository;
    private final OrganizerProfileRepository organizerProfileRepository;
    private final OutboxService outboxService;
    private final RedisSeatLockService redisSeatLockService;

    public EventService(
            EventRepository eventRepository,
            SeatTierRepository seatTierRepository,
            SeatRepository seatRepository,
            OrganizerProfileRepository organizerProfileRepository,
            OutboxService outboxService,
            RedisSeatLockService redisSeatLockService
    ) {
        this.eventRepository = eventRepository;
        this.seatTierRepository = seatTierRepository;
        this.seatRepository = seatRepository;
        this.organizerProfileRepository = organizerProfileRepository;
        this.outboxService = outboxService;
        this.redisSeatLockService = redisSeatLockService;
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

