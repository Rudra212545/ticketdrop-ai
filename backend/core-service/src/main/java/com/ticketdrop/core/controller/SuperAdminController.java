package com.ticketdrop.core.controller;

import com.ticketdrop.core.domain.enums.ApprovalStatus;
import com.ticketdrop.core.dto.PlatformDtos.*;
import com.ticketdrop.core.security.UserPrincipal;
import com.ticketdrop.core.service.SuperAdminService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/super-admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminController {

    private final SuperAdminService superAdminService;

    public SuperAdminController(SuperAdminService superAdminService) {
        this.superAdminService = superAdminService;
    }

    @GetMapping("/organizers")
    public ResponseEntity<List<OrganizerSummary>> listOrganizers(
            @RequestParam(required = false) ApprovalStatus status
    ) {
        return ResponseEntity.ok(superAdminService.listOrganizers(status));
    }

    @PatchMapping("/organizers/{profileId}/decision")
    public ResponseEntity<OrganizerSummary> decideOrganizer(
            @PathVariable UUID profileId,
            @Valid @RequestBody OrganizerDecisionRequest request,
            Authentication authentication
    ) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(superAdminService.decideOrganizer(profileId, principal.id(), request));
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserModerationResponse>> listUsers() {
        return ResponseEntity.ok(superAdminService.listUsers());
    }

    @PostMapping("/users/{userId}/ban")
    public ResponseEntity<UserModerationResponse> banUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(superAdminService.banUser(userId));
    }

    @PostMapping("/users/{userId}/unban")
    public ResponseEntity<UserModerationResponse> unbanUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(superAdminService.unbanUser(userId));
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<Page<AuditLogResponse>> auditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(superAdminService.listAuditLogs(page, size));
    }
}

