package com.ticketdrop.core.controller;

import com.ticketdrop.core.dto.BookingDtos.LockSeatsRequest;
import com.ticketdrop.core.dto.BookingDtos.LockSeatsResponse;
import com.ticketdrop.core.dto.EventDtos.EventSummary;
import com.ticketdrop.core.dto.EventDtos.QueueStatusResponse;
import com.ticketdrop.core.dto.EventDtos.SeatMapResponse;
import com.ticketdrop.core.security.UserPrincipal;
import com.ticketdrop.core.service.BookingService;
import com.ticketdrop.core.service.EventService;
import com.ticketdrop.core.service.SeatMapBroadcaster;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {

    private final EventService eventService;
    private final BookingService bookingService;
    private final SeatMapBroadcaster seatMapBroadcaster;

    public EventController(
            EventService eventService,
            BookingService bookingService,
            SeatMapBroadcaster seatMapBroadcaster
    ) {
        this.eventService = eventService;
        this.bookingService = bookingService;
        this.seatMapBroadcaster = seatMapBroadcaster;
    }

    @GetMapping
    public ResponseEntity<List<EventSummary>> listPublished(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String category
    ) {
        return ResponseEntity.ok(eventService.listPublishedEvents(city, category));
    }

    @GetMapping("/{eventId}/seatmap")
    public ResponseEntity<SeatMapResponse> seatMap(
            @PathVariable UUID eventId,
            Authentication authentication
    ) {
        UUID userId = (authentication != null && authentication.getPrincipal() instanceof UserPrincipal p)
                ? p.id()
                : null;
        return ResponseEntity.ok(eventService.getSeatMap(eventId, userId));
    }

    @GetMapping(value = "/{eventId}/seatmap/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamSeatUpdates(@PathVariable UUID eventId) {
        return seatMapBroadcaster.subscribe(eventId);
    }

    @PostMapping("/{eventId}/queue/join")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<QueueStatusResponse> joinQueue(
            @PathVariable UUID eventId,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(eventService.joinWaitingRoom(eventId, principal.id()));
    }

    @PostMapping("/{eventId}/seats/lock")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<LockSeatsResponse> lockSeats(
            @PathVariable UUID eventId,
            @Valid @RequestBody LockSeatsRequest request,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(bookingService.lockSeats(eventId, principal.id(), request));
    }
}

