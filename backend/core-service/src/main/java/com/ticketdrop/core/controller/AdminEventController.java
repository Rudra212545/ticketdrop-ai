package com.ticketdrop.core.controller;

import com.ticketdrop.core.dto.EventDtos.CreateEventRequest;
import com.ticketdrop.core.dto.EventDtos.EventSummary;
import com.ticketdrop.core.dto.EventDtos.UpdateEventRequest;
import com.ticketdrop.core.security.UserPrincipal;
import com.ticketdrop.core.service.EventService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/events")
@PreAuthorize("hasRole('ADMIN')")
public class AdminEventController {

    private final EventService eventService;

    public AdminEventController(EventService eventService) {
        this.eventService = eventService;
    }

    @GetMapping
    public ResponseEntity<List<EventSummary>> myEvents(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(eventService.listOrganizerEvents(principal.id()));
    }

    @PostMapping
    public ResponseEntity<EventSummary> createEvent(
            @Valid @RequestBody CreateEventRequest request,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(eventService.createEvent(principal.id(), request));
    }

    @PatchMapping("/{eventId}")
    public ResponseEntity<EventSummary> updateEvent(
            @PathVariable UUID eventId,
            @Valid @RequestBody UpdateEventRequest request,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(eventService.updateEvent(eventId, principal.id(), request));
    }

    @PatchMapping("/{eventId}/publish")
    public ResponseEntity<EventSummary> publishEvent(
            @PathVariable UUID eventId,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(eventService.publishEvent(eventId, principal.id()));
    }
}

