package com.ticketdrop.core.controller;

import com.ticketdrop.core.dto.BookingDtos.BookingResponse;
import com.ticketdrop.core.dto.Phase3Dtos.JoinWaitlistRequest;
import com.ticketdrop.core.dto.Phase3Dtos.WaitlistEntryResponse;
import com.ticketdrop.core.security.UserPrincipal;
import com.ticketdrop.core.service.WaitlistService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/waitlist")
@PreAuthorize("hasRole('USER')")
public class WaitlistController {

    private final WaitlistService waitlistService;

    public WaitlistController(WaitlistService waitlistService) {
        this.waitlistService = waitlistService;
    }

    @PostMapping
    public ResponseEntity<WaitlistEntryResponse> join(
            @Valid @RequestBody JoinWaitlistRequest req,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(waitlistService.joinWaitlist(principal.id(), req.eventId(), req.tierId()));
    }

    @GetMapping("/me")
    public ResponseEntity<List<WaitlistEntryResponse>> myWaitlist(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(waitlistService.getMyWaitlist(principal.id()));
    }

    @DeleteMapping("/{entryId}")
    public ResponseEntity<Void> leave(@PathVariable UUID entryId, Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        waitlistService.leaveWaitlist(entryId, principal.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{entryId}/claim")
    public ResponseEntity<BookingResponse> claimOffer(
            @PathVariable UUID entryId,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(waitlistService.claimOffer(entryId, principal.id()));
    }
}

