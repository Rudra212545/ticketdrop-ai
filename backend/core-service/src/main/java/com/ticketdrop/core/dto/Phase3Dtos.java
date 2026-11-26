package com.ticketdrop.core.dto;

import com.ticketdrop.core.domain.enums.OutboxStatus;
import com.ticketdrop.core.domain.enums.ResaleStatus;
import com.ticketdrop.core.domain.enums.WaitlistStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class Phase3Dtos {
    private Phase3Dtos() {}

    // ── Smart Auto-Waitlist ─────────────────────────────────────────────
    public record JoinWaitlistRequest(
            @NotNull UUID eventId,
            @NotNull UUID tierId
    ) {}

    public record WaitlistEntryResponse(
            UUID id,
            UUID eventId,
            String eventTitle,
            String venueName,
            String city,
            UUID tierId,
            String tierName,
            long tierPricePaise,
            WaitlistStatus status,
            UUID offeredSeatId,
            String offeredSeatLabel,
            Instant offerExpiresAt,
            long queuePosition,
            Instant createdAt
    ) {}

    // ── Anti-Scalper Price-Capped Resale Escrow ─────────────────────────
    public record CreateResaleRequest(
            @NotNull UUID ticketId,
            @Min(100) long askingPricePaise
    ) {}

    public record ResaleListingResponse(
            UUID id,
            UUID ticketId,
            UUID eventId,
            String eventTitle,
            String venueName,
            String city,
            Instant eventStartAt,
            String tierName,
            String passLabel,
            UUID sellerId,
            String sellerName,
            long originalPricePaise,
            long askingPricePaise,
            long maxAllowedPricePaise,
            ResaleStatus status,
            Instant createdAt,
            Instant soldAt
    ) {}

    // ── Venue Gate QR Scanner ───────────────────────────────────────────
    public record VerifyQrRequest(
            @NotBlank String qrTokenId,
            String qrSignature,
            UUID eventId
    ) {}

    public record VerifyQrResponse(
            boolean valid,
            String outcome,
            String message,
            UUID ticketId,
            String eventTitle,
            String tierName,
            String passLabel,
            String attendeeName,
            Instant scannedAt
    ) {}

    // ── Outbox & DLQ Replay Console (SUPER_ADMIN) ───────────────────────
    public record OutboxEventResponse(
            UUID id,
            String aggregateType,
            UUID aggregateId,
            String topic,
            String payload,
            OutboxStatus status,
            int retryCount,
            String lastError,
            Instant createdAt,
            Instant publishedAt,
            Instant dlqReplayedAt
    ) {}

    public record OutboxSummaryResponse(
            boolean kafkaEnabled,
            long pendingCount,
            long publishedCount,
            long failedCount,
            List<OutboxEventResponse> recentEvents
    ) {}
}

