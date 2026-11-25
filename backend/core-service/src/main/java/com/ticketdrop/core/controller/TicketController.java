package com.ticketdrop.core.controller;

import com.ticketdrop.core.dto.BookingDtos.TicketResponse;
import com.ticketdrop.core.security.UserPrincipal;
import com.ticketdrop.core.service.BookingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tickets")
@PreAuthorize("hasRole('USER')")
public class TicketController {

    private final BookingService bookingService;

    public TicketController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @GetMapping("/me")
    public ResponseEntity<List<TicketResponse>> myTickets(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(bookingService.getMyTickets(principal.id()));
    }
}

