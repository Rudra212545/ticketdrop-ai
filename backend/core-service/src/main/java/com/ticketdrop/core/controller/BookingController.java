package com.ticketdrop.core.controller;

import com.ticketdrop.core.dto.BookingDtos.*;
import com.ticketdrop.core.security.UserPrincipal;
import com.ticketdrop.core.service.BookingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bookings")
@PreAuthorize("hasRole('USER')")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<BookingResponse> checkout(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody CheckoutRequest request,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bookingService.checkout(principal.id(), idempotencyKey, request));
    }

    @PostMapping("/standing/checkout")
    public ResponseEntity<BookingResponse> checkoutStanding(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody StandingCheckoutRequest request,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(bookingService.checkoutStanding(principal.id(), idempotencyKey, request));
    }

    @PostMapping("/{bookingId}/confirm-payment")
    public ResponseEntity<BookingResponse> confirmPayment(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) ConfirmPaymentRequest request,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(bookingService.confirmPayment(bookingId, principal.id(), request));
    }

    @PostMapping("/{bookingId}/cancel")
    public ResponseEntity<BookingResponse> cancelBooking(
            @PathVariable UUID bookingId,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(bookingService.cancelBooking(bookingId, principal.id()));
    }
}

