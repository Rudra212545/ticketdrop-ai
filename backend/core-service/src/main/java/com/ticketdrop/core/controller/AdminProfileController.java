package com.ticketdrop.core.controller;

import com.ticketdrop.core.dto.PlatformDtos.OrganizerSummary;
import com.ticketdrop.core.security.UserPrincipal;
import com.ticketdrop.core.service.SuperAdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminProfileController {

    private final SuperAdminService superAdminService;

    public AdminProfileController(SuperAdminService superAdminService) {
        this.superAdminService = superAdminService;
    }

    @GetMapping("/profile")
    public ResponseEntity<OrganizerSummary> myOrganizerProfile(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(superAdminService.getOrganizerByUserId(principal.id()));
    }
}

