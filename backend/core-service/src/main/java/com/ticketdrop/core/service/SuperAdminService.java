package com.ticketdrop.core.service;

import com.ticketdrop.core.audit.Audited;
import com.ticketdrop.core.domain.entity.OrganizerProfile;
import com.ticketdrop.core.domain.entity.User;
import com.ticketdrop.core.domain.enums.ApprovalStatus;
import com.ticketdrop.core.domain.enums.Role;
import com.ticketdrop.core.domain.enums.UserStatus;
import com.ticketdrop.core.dto.PlatformDtos.*;
import com.ticketdrop.core.exception.ApiException;
import com.ticketdrop.core.repository.AuditLogRepository;
import com.ticketdrop.core.repository.OrganizerProfileRepository;
import com.ticketdrop.core.repository.UserRepository;
import com.ticketdrop.core.security.RedisTokenService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class SuperAdminService {

    private final OrganizerProfileRepository organizerProfileRepository;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final RedisTokenService redisTokenService;

    public SuperAdminService(
            OrganizerProfileRepository organizerProfileRepository,
            UserRepository userRepository,
            AuditLogRepository auditLogRepository,
            RedisTokenService redisTokenService
    ) {
        this.organizerProfileRepository = organizerProfileRepository;
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.redisTokenService = redisTokenService;
    }

    @Transactional(readOnly = true)
    public List<OrganizerSummary> listOrganizers(ApprovalStatus status) {
        List<OrganizerProfile> profiles = status != null
                ? organizerProfileRepository.findByApprovalStatusOrderByCreatedAtDesc(status)
                : organizerProfileRepository.findAllByOrderByCreatedAtDesc();
        return profiles.stream().map(this::toOrganizerSummary).toList();
    }

    @Transactional
    @Audited(action = "ORGANIZER_DECISION", resourceType = "ORGANIZER_PROFILE")
    public OrganizerSummary decideOrganizer(UUID profileId, UUID superAdminId, OrganizerDecisionRequest req) {
        OrganizerProfile profile = organizerProfileRepository.findById(profileId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Organizer Not Found", "Organizer profile does not exist."));

        profile.setApprovalStatus(req.decision());
        profile.setApprovedBy(superAdminId);
        if (req.platformFeeBps() != null && req.platformFeeBps() >= 0 && req.platformFeeBps() <= 3000) {
            profile.setPlatformFeeBps(req.platformFeeBps());
        }

        User owner = profile.getUser();
        if (req.decision() == ApprovalStatus.APPROVED) {
            owner.setStatus(UserStatus.ACTIVE);
            redisTokenService.unbanUser(owner.getId());
        } else if (req.decision() == ApprovalStatus.SUSPENDED) {
            owner.setStatus(UserStatus.BANNED);
            redisTokenService.markUserBanned(owner.getId());
        } else {
            owner.setStatus(UserStatus.PENDING_APPROVAL);
        }

        userRepository.save(owner);
        return toOrganizerSummary(organizerProfileRepository.save(profile));
    }

    @Transactional(readOnly = true)
    public List<UserModerationResponse> listUsers() {
        return userRepository.findAll().stream()
                .map(u -> new UserModerationResponse(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getStatus(), u.getCreatedAt()))
                .toList();
    }

    @Transactional
    @Audited(action = "USER_BANNED", resourceType = "USER")
    public UserModerationResponse banUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User Not Found", "User does not exist."));
        if (user.getRole() == Role.SUPER_ADMIN) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid Action", "Cannot ban a SUPER_ADMIN account.");
        }
        user.setStatus(UserStatus.BANNED);
        userRepository.save(user);
        redisTokenService.markUserBanned(userId);
        return new UserModerationResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole(), user.getStatus(), user.getCreatedAt());
    }

    @Transactional
    @Audited(action = "USER_UNBANNED", resourceType = "USER")
    public UserModerationResponse unbanUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User Not Found", "User does not exist."));
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);
        redisTokenService.unbanUser(userId);
        return new UserModerationResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole(), user.getStatus(), user.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> listAuditLogs(int page, int size) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, Math.min(size, 100)))
                .map(a -> new AuditLogResponse(
                        a.getId(),
                        a.getActorId(),
                        a.getActorRole(),
                        a.getAction(),
                        a.getResourceType(),
                        a.getResourceId(),
                        a.getNewState(),
                        a.getIpAddress(),
                        a.getCreatedAt()
                ));
    }

    @Transactional(readOnly = true)
    public OrganizerSummary getOrganizerByUserId(UUID userId) {
        OrganizerProfile profile = organizerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile Not Found", "Organizer profile not found."));
        return toOrganizerSummary(profile);
    }

    private OrganizerSummary toOrganizerSummary(OrganizerProfile p) {
        return new OrganizerSummary(
                p.getId(),
                p.getUser().getId(),
                p.getUser().getEmail(),
                p.getUser().getFullName(),
                p.getOrgName(),
                p.getRegistrationNo(),
                p.getApprovalStatus(),
                p.getPlatformFeeBps(),
                p.getCreatedAt()
        );
    }
}

