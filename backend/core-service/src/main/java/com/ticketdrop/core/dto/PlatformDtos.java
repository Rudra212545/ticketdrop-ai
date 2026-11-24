package com.ticketdrop.core.dto;

import com.ticketdrop.core.domain.enums.ApprovalStatus;
import com.ticketdrop.core.domain.enums.Role;
import com.ticketdrop.core.domain.enums.UserStatus;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;

public final class PlatformDtos {
    private PlatformDtos() {}

    public record OrganizerSummary(
            UUID profileId,
            UUID userId,
            String email,
            String fullName,
            String orgName,
            String registrationNo,
            ApprovalStatus approvalStatus,
            int platformFeeBps,
            Instant createdAt
    ) {}

    public record OrganizerDecisionRequest(
            @NotNull ApprovalStatus decision,
            Integer platformFeeBps
    ) {}

    public record AuditLogResponse(
            UUID id,
            UUID actorId,
            String actorRole,
            String action,
            String resourceType,
            String resourceId,
            String newState,
            String ipAddress,
            Instant createdAt
    ) {}

    public record UserModerationResponse(
            UUID id,
            String email,
            String fullName,
            Role role,
            UserStatus status,
            Instant createdAt
    ) {}
}

