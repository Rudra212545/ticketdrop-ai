package com.ticketdrop.core.controller;

import com.ticketdrop.core.dto.Phase3Dtos.VerifyQrRequest;
import com.ticketdrop.core.dto.Phase3Dtos.VerifyQrResponse;
import com.ticketdrop.core.security.UserPrincipal;
import com.ticketdrop.core.service.GateScannerService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/tickets")
@PreAuthorize("hasRole('ADMIN')")
public class AdminTicketScannerController {

    private final GateScannerService gateScannerService;

    public AdminTicketScannerController(GateScannerService gateScannerService) {
        this.gateScannerService = gateScannerService;
    }

    @PostMapping("/verify-qr")
    public ResponseEntity<VerifyQrResponse> verifyQr(
            @Valid @RequestBody VerifyQrRequest req,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(gateScannerService.verifyAndAdmit(principal.id(), req));
    }
}

