package com.ticketdrop.core.service;

import com.ticketdrop.core.audit.Audited;
import com.ticketdrop.core.domain.entity.Event;
import com.ticketdrop.core.domain.entity.OrganizerProfile;
import com.ticketdrop.core.domain.entity.Ticket;
import com.ticketdrop.core.domain.enums.TicketStatus;
import com.ticketdrop.core.dto.Phase3Dtos.VerifyQrRequest;
import com.ticketdrop.core.dto.Phase3Dtos.VerifyQrResponse;
import com.ticketdrop.core.exception.ApiException;
import com.ticketdrop.core.repository.OrganizerProfileRepository;
import com.ticketdrop.core.repository.TicketRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class GateScannerService {

    private final TicketRepository ticketRepository;
    private final OrganizerProfileRepository organizerProfileRepository;
    private final QrSigningService qrSigningService;
    private final StringRedisTemplate redisTemplate;

    public GateScannerService(
            TicketRepository ticketRepository,
            OrganizerProfileRepository organizerProfileRepository,
            QrSigningService qrSigningService,
            StringRedisTemplate redisTemplate
    ) {
        this.ticketRepository = ticketRepository;
        this.organizerProfileRepository = organizerProfileRepository;
        this.qrSigningService = qrSigningService;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    @Audited(action = "QR_SCANNED", resourceType = "TICKET")
    public VerifyQrResponse verifyAndAdmit(UUID organizerUserId, VerifyQrRequest req) {
        OrganizerProfile organizer = organizerProfileRepository.findByUserId(organizerUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Organizer Not Found", "Organizer profile not found."));

        UUID qrTokenId;
        try {
            qrTokenId = UUID.fromString(req.qrTokenId().trim());
        } catch (IllegalArgumentException ex) {
            return new VerifyQrResponse(false, "INVALID_FORMAT", "QR token is not a valid UUID.", null, null, null, null, null, Instant.now());
        }

        // 1. O(1) Redis revocation check (catches resold screenshots & cancelled events immediately)
        String revokedReason = redisTemplate.opsForValue().get("qr:revoked:" + qrTokenId);
        if (revokedReason != null) {
            return new VerifyQrResponse(
                    false,
                    "REVOKED",
                    "Pass rejected: QR token was revoked (" + revokedReason + "). Do not admit.",
                    null, null, null, null, null, Instant.now()
            );
        }

        Ticket ticket = ticketRepository.findByQrTokenId(qrTokenId).orElse(null);
        if (ticket == null) {
            return new VerifyQrResponse(
                    false,
                    "NOT_FOUND",
                    "Pass not found. Counterfeit or expired QR token.",
                    null, null, null, null, null, Instant.now()
            );
        }

        Event event = ticket.getBooking().getEvent();
        if (!event.getOrganizer().getId().equals(organizer.getId())) {
            return new VerifyQrResponse(
                    false,
                    "WRONG_ORGANIZER",
                    "This pass belongs to another organizer's event.",
                    ticket.getId(), event.getTitle(), null, ticket.getPassLabel(), null, Instant.now()
            );
        }

        if (req.eventId() != null && !event.getId().equals(req.eventId())) {
            return new VerifyQrResponse(
                    false,
                    "WRONG_EVENT",
                    "This pass is for \"" + event.getTitle() + "\", not the selected event.",
                    ticket.getId(), event.getTitle(),
                    ticket.getTier() != null ? ticket.getTier().getName() : "General",
                    ticket.getPassLabel(), ticket.getOwner().getFullName(), Instant.now()
            );
        }

        if (req.qrSignature() != null && !req.qrSignature().isBlank()) {
            String resourceId = ticket.getSeat() != null
                    ? ticket.getSeat().getId().toString()
                    : (ticket.getTier() != null ? ticket.getTier().getId().toString() : ticket.getId().toString());
            if (!qrSigningService.verify(qrTokenId, resourceId, ticket.getOwner().getId(), req.qrSignature().trim())) {
                return new VerifyQrResponse(
                        false,
                        "TAMPERED_SIGNATURE",
                        "Cryptographic HMAC signature mismatch! Pass may be forged.",
                        ticket.getId(), event.getTitle(),
                        ticket.getTier() != null ? ticket.getTier().getName() : "General",
                        ticket.getPassLabel(), ticket.getOwner().getFullName(), Instant.now()
                );
            }
        }

        String tierName = ticket.getTier() != null ? ticket.getTier().getName() : "General";

        if (ticket.getStatus() == TicketStatus.USED) {
            return new VerifyQrResponse(
                    false,
                    "ALREADY_USED",
                    "Duplicate entry attempt! Pass was already scanned at " + ticket.getUsedAt(),
                    ticket.getId(), event.getTitle(), tierName, ticket.getPassLabel(),
                    ticket.getOwner().getFullName(), ticket.getUsedAt()
            );
        }

        if (ticket.getStatus() != TicketStatus.ACTIVE) {
            return new VerifyQrResponse(
                    false,
                    ticket.getStatus().name(),
                    "Pass is currently " + ticket.getStatus() + " and cannot be admitted.",
                    ticket.getId(), event.getTitle(), tierName, ticket.getPassLabel(),
                    ticket.getOwner().getFullName(), Instant.now()
            );
        }

        Instant now = Instant.now();
        ticket.setStatus(TicketStatus.USED);
        ticket.setUsedAt(now);
        ticketRepository.save(ticket);

        return new VerifyQrResponse(
                true,
                "ADMITTED",
                "Verified! Admit attendee to " + tierName + " (" + ticket.getPassLabel() + ").",
                ticket.getId(), event.getTitle(), tierName, ticket.getPassLabel(),
                ticket.getOwner().getFullName(), now
        );
    }
}

