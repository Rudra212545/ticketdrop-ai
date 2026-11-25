package com.ticketdrop.core.dto;

import com.ticketdrop.core.domain.enums.EventStatus;
import com.ticketdrop.core.domain.enums.SeatStatus;
import com.ticketdrop.core.domain.enums.SeatingMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class EventDtos {
    private EventDtos() {}

    public record TierSpec(
            @NotBlank @Size(max = 100) String name,
            @Min(0) long basePricePaise,
            String colorCode,
            String rowPrefix,
            Integer rowCount,
            Integer seatsPerRow,
            Integer capacity
    ) {}

    public record CreateEventRequest(
            @NotBlank @Size(min = 3, max = 255) String title,
            @NotBlank String description,
            @NotBlank @Size(max = 64) String category,
            @NotBlank @Size(max = 100) String city,
            @NotBlank @Size(max = 200) String venueName,
            @NotNull Instant eventStartAt,
            SeatingMode seatingMode,
            boolean flashSaleEnabled,
            Instant flashSaleStartAt,
            boolean resaleEnabled,
            @DecimalMin("1.00") @DecimalMax("2.00") BigDecimal maxResaleMultiplier,
            @NotEmpty @Valid List<TierSpec> tiers
    ) {}

    public record UpdateEventRequest(
            @NotBlank @Size(min = 3, max = 255) String title,
            @NotBlank String description,
            @NotBlank @Size(max = 64) String category,
            @NotBlank @Size(max = 100) String city,
            @NotBlank @Size(max = 200) String venueName,
            @NotNull Instant eventStartAt,
            boolean flashSaleEnabled,
            boolean resaleEnabled,
            @DecimalMin("1.00") @DecimalMax("2.00") BigDecimal maxResaleMultiplier
    ) {}

    public record TierSummary(
            UUID id,
            String name,
            long basePricePaise,
            String colorCode,
            int totalSeats,
            int availableSeats
    ) {}

    public record EventSummary(
            UUID id,
            UUID organizerId,
            String organizerName,
            String title,
            String description,
            String category,
            String city,
            String venueName,
            Instant eventStartAt,
            SeatingMode seatingMode,
            boolean flashSaleEnabled,
            boolean resaleEnabled,
            BigDecimal maxResaleMultiplier,
            EventStatus status,
            long minPricePaise,
            int totalSeats,
            int availableSeats,
            List<TierSummary> tiers,
            Instant createdAt
    ) {}

    public record SeatDto(
            UUID id,
            UUID tierId,
            String tierName,
            long pricePaise,
            String rowLabel,
            int seatNumber,
            SeatStatus status,
            boolean lockedByCurrentUser,
            Instant lockedUntil
    ) {}

    public record SeatMapResponse(
            EventSummary event,
            List<SeatDto> seats
    ) {}

    public record QueueStatusResponse(
            UUID eventId,
            boolean admitted,
            long position,
            long totalInQueue,
            String admissionToken
    ) {}
}
