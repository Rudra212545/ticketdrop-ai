package com.ticketdrop.core.controller;

import com.ticketdrop.core.dto.Phase3Dtos.CreateResaleRequest;
import com.ticketdrop.core.dto.Phase3Dtos.ResaleListingResponse;
import com.ticketdrop.core.security.UserPrincipal;
import com.ticketdrop.core.service.ResaleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/resale")
public class ResaleController {

    private final ResaleService resaleService;

    public ResaleController(ResaleService resaleService) {
        this.resaleService = resaleService;
    }

    @GetMapping
    public ResponseEntity<List<ResaleListingResponse>> listActive(
            @RequestParam(required = false) UUID eventId
    ) {
        return ResponseEntity.ok(resaleService.listActiveListings(eventId));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<List<ResaleListingResponse>> myListings(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(resaleService.listMyListings(principal.id()));
    }

    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ResaleListingResponse> createListing(
            @Valid @RequestBody CreateResaleRequest req,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(resaleService.createListing(principal.id(), req));
    }

    @DeleteMapping("/{listingId}")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<Void> cancelListing(
            @PathVariable UUID listingId,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        resaleService.cancelListing(listingId, principal.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{listingId}/purchase")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ResaleListingResponse> purchase(
            @PathVariable UUID listingId,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(resaleService.purchaseListing(listingId, principal.id()));
    }
}

