package com.ticketdrop.core.dto;

import com.ticketdrop.core.domain.enums.BookingStatus;
import com.ticketdrop.core.domain.enums.TicketStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class BookingDtos {
    private BookingDtos() {}

    public record LockSeatsRequest(
            @NotEmpty @Size(min = 1, max = 6) List<UUID> seatIds
    ) {}

    public record LockSeatsResponse(
            UUID eventId,
            List<UUID> lockedSeatIds,
            String lockToken,
            Instant expiresAt,
            long ttlSeconds
    ) {}

    public record CheckoutRequest(
            @NotNull UUID eventId,
            @NotEmpty @Size(min = 1, max = 6) List<UUID> seatIds
    ) {}

    public record ZoneQuantity(
            @NotNull UUID tierId,
            @Min(1) @Max(6) int quantity
    ) {}

    public record StandingCheckoutRequest(
            @NotNull UUID eventId,
            @NotEmpty @Valid List<ZoneQuantity> items
    ) {}

    public record ConfirmPaymentRequest(
            boolean simulateFailure
    ) {}

    public record BookingResponse(
            UUID id,
            UUID eventId,
            String eventTitle,
            String idempotencyKey,
            long subtotalPaise,
            long platformFeePaise,
            long totalAmountPaise,
            BookingStatus status,
            String paymentRef,
            Instant expiresAt,
            Instant createdAt,
            List<TicketResponse> tickets
    ) {}

    public record TicketResponse(
            UUID id,
            UUID bookingId,
            UUID eventId,
            String eventTitle,
            String venueName,
            String city,
            Instant eventStartAt,
            String tierName,
            String rowLabel,
            Integer seatNumber,
            String passLabel,
            long pricePaise,
            UUID qrTokenId,
            String qrSignature,
            TicketStatus status,
            Instant issuedAt
    ) {}
}
