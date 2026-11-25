package com.ticketdrop.core.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketdrop.core.domain.entity.OutboxEvent;
import com.ticketdrop.core.domain.enums.OutboxStatus;
import com.ticketdrop.core.repository.OutboxEventRepository;
import com.ticketdrop.events.DomainEventEnvelope;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Transactional Outbox writer: persists domain events in the same PostgreSQL transaction
 * as business state mutations so Kafka never misses an event on crash.
 */
@Service
public class OutboxService {

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public OutboxService(OutboxEventRepository outboxEventRepository, ObjectMapper objectMapper) {
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    public <T> void enqueue(String aggregateType, UUID aggregateId, String topic, String eventType, T payload) {
        try {
            var envelope = DomainEventEnvelope.of(eventType, UUID.randomUUID().toString(), payload);
            OutboxEvent event = new OutboxEvent();
            event.setAggregateType(aggregateType);
            event.setAggregateId(aggregateId);
            event.setTopic(topic);
            event.setPayload(objectMapper.writeValueAsString(envelope));
            event.setStatus(OutboxStatus.PENDING);
            outboxEventRepository.save(event);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize outbox event payload", ex);
        }
    }
}

