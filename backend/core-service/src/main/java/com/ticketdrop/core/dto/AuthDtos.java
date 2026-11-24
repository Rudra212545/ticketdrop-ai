package com.ticketdrop.core.dto;

import com.ticketdrop.core.domain.enums.ApprovalStatus;
import com.ticketdrop.core.domain.enums.Role;
import com.ticketdrop.core.domain.enums.UserStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotBlank @Size(min = 2, max = 150) String fullName,
            @NotNull Role role,
            String orgName,
            String registrationNo
    ) {}

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    public record RefreshRequest(
            @NotBlank String refreshToken
    ) {}

    public record LogoutRequest(
            String refreshToken
    ) {}

    public record UserSummary(
            UUID id,
            String email,
            String fullName,
            Role role,
            UserStatus status,
            ApprovalStatus organizerApprovalStatus,
            String orgName,
            Instant createdAt
    ) {}

    public record AuthResponse(
            String accessToken,
            String refreshToken,
            long expiresInMs,
            UserSummary user
    ) {}
}

