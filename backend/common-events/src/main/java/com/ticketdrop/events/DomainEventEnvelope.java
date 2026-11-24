package com.ticketdrop.events;

import java.time.Instant;
import java.util.UUID;

/**
 * Standard Kafka / Outbox event envelope shared across all TicketDrop AI services.
 */
public record DomainEventEnvelope<T>(
        UUID eventId,
        String eventType,
        String correlationId,
        Instant occurredAt,
        T payload
) {
    public static <T> DomainEventEnvelope<T> of(String eventType, String correlationId, T payload) {
        return new DomainEventEnvelope<>(
                UUID.randomUUID(),
                eventType,
                correlationId != null ? correlationId : UUID.randomUUID().toString(),
                Instant.now(),
                payload
        );
    }
}

