package com.ticketdrop.core.service;

import com.ticketdrop.core.domain.entity.OrganizerProfile;
import com.ticketdrop.core.domain.entity.User;
import com.ticketdrop.core.domain.enums.ApprovalStatus;
import com.ticketdrop.core.domain.enums.Role;
import com.ticketdrop.core.domain.enums.UserStatus;
import com.ticketdrop.core.dto.AuthDtos.*;
import com.ticketdrop.core.exception.ApiException;
import com.ticketdrop.core.repository.OrganizerProfileRepository;
import com.ticketdrop.core.repository.UserRepository;
import com.ticketdrop.core.security.JwtService;
import com.ticketdrop.core.security.RedisTokenService;
import com.ticketdrop.core.security.UserPrincipal;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final OrganizerProfileRepository organizerProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RedisTokenService redisTokenService;

    public AuthService(
            UserRepository userRepository,
            OrganizerProfileRepository organizerProfileRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RedisTokenService redisTokenService
    ) {
        this.userRepository = userRepository;
        this.organizerProfileRepository = organizerProfileRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.redisTokenService = redisTokenService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (req.role() == Role.SUPER_ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Forbidden Role", "SUPER_ADMIN accounts cannot be self-registered.");
        }
        if (userRepository.existsByEmailIgnoreCase(req.email())) {
            throw new ApiException(HttpStatus.CONFLICT, "Email Already Exists", "An account with this email already exists.");
        }
        if (req.role() == Role.ADMIN && (req.orgName() == null || req.orgName().isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Organization Required", "Organizer accounts must provide an organization name.");
        }

        User user = new User();
        user.setEmail(req.email().trim().toLowerCase());
        user.setFullName(req.fullName().trim());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(req.role());
        user.setStatus(req.role() == Role.ADMIN ? UserStatus.PENDING_APPROVAL : UserStatus.ACTIVE);
        user = userRepository.save(user);

        OrganizerProfile profile = null;
        if (req.role() == Role.ADMIN) {
            profile = new OrganizerProfile();
            profile.setUser(user);
            profile.setOrgName(req.orgName().trim());
            profile.setRegistrationNo(req.registrationNo());
            profile.setApprovalStatus(ApprovalStatus.PENDING);
            profile = organizerProfileRepository.save(profile);
        }

        return issueTokens(user, profile);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmailIgnoreCase(req.email().trim())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid Credentials", "Email or password is incorrect."));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid Credentials", "Email or password is incorrect.");
        }
        if (user.getStatus() == UserStatus.BANNED || redisTokenService.isUserBanned(user.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Account Banned", "Your account has been suspended by platform moderation.");
        }

        OrganizerProfile profile = user.getRole() == Role.ADMIN
                ? organizerProfileRepository.findByUserId(user.getId()).orElse(null)
                : null;
        return issueTokens(user, profile);
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(RefreshRequest req) {
        try {
            Claims claims = jwtService.parseClaims(req.refreshToken());
            if (!"REFRESH".equals(claims.get("type", String.class))) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid Token", "Expected a refresh token.");
            }
            UUID userId = UUID.fromString(claims.getSubject());
            String jti = claims.getId();

            if (!redisTokenService.isRefreshTokenValid(userId, jti)) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Token Revoked", "Refresh token has expired or been rotated.");
            }
            redisTokenService.revokeRefreshToken(userId, jti);

            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User Not Found", "User no longer exists."));
            if (user.getStatus() == UserStatus.BANNED) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Account Banned", "Account is banned.");
            }

            OrganizerProfile profile = user.getRole() == Role.ADMIN
                    ? organizerProfileRepository.findByUserId(user.getId()).orElse(null)
                    : null;
            return issueTokens(user, profile);
        } catch (JwtException | IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid Refresh Token", "Refresh token is malformed or expired.");
        }
    }

    public void logout(String bearerToken, LogoutRequest req) {
        if (bearerToken != null && !bearerToken.isBlank()) {
            try {
                Claims accessClaims = jwtService.parseClaims(bearerToken);
                redisTokenService.blacklistAccessToken(accessClaims.getId(), accessClaims.getExpiration().toInstant());
            } catch (JwtException ignored) {
            }
        }
        if (req != null && req.refreshToken() != null && !req.refreshToken().isBlank()) {
            try {
                Claims refreshClaims = jwtService.parseClaims(req.refreshToken());
                redisTokenService.revokeRefreshToken(UUID.fromString(refreshClaims.getSubject()), refreshClaims.getId());
            } catch (JwtException | IllegalArgumentException ignored) {
            }
        }
    }

    @Transactional(readOnly = true)
    public UserSummary getCurrentUser(UserPrincipal principal) {
        User user = userRepository.findById(principal.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User Not Found", "Authenticated user not found."));
        OrganizerProfile profile = user.getRole() == Role.ADMIN
                ? organizerProfileRepository.findByUserId(user.getId()).orElse(null)
                : null;
        return toSummary(user, profile);
    }

    private AuthResponse issueTokens(User user, OrganizerProfile profile) {
        var access = jwtService.generateAccessToken(user);
        var refresh = jwtService.generateRefreshToken(user);
        redisTokenService.storeRefreshToken(user.getId(), refresh.jti(), Duration.ofMillis(jwtService.getRefreshExpirationMs()));
        return new AuthResponse(access.token(), refresh.token(), jwtService.getAccessExpirationMs(), toSummary(user, profile));
    }

    private UserSummary toSummary(User user, OrganizerProfile profile) {
        return new UserSummary(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.getStatus(),
                profile != null ? profile.getApprovalStatus() : null,
                profile != null ? profile.getOrgName() : null,
                user.getCreatedAt()
        );
    }
}

