package com.ticketdrop.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketdrop.core.audit.Audited;
import com.ticketdrop.core.domain.entity.OutboxEvent;
import com.ticketdrop.core.domain.enums.OutboxStatus;
import com.ticketdrop.core.dto.Phase3Dtos.OutboxEventResponse;
import com.ticketdrop.core.dto.Phase3Dtos.OutboxSummaryResponse;
import com.ticketdrop.core.exception.ApiException;
import com.ticketdrop.core.repository.OutboxEventRepository;
import com.ticketdrop.events.KafkaTopics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Transactional Outbox Poller & Dead-Letter Queue (DLQ) Replay Engine.
 * Dispatches domain events every 3 seconds:
 * - In local low-RAM mode (app.kafka.enabled=false), dispatches directly in-process
 *   so Auto-Waitlist offers, Resale notifications, and Cancellation handlers fire immediately.
 * - Tracks retries up to 3 attempts before routing failed messages to DLQ (OutboxStatus.FAILED),
 *   which Super Admins can inspect and replay with one click.
 */
@Service
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final int MAX_RETRIES = 3;

    private final OutboxEventRepository outboxRepository;
    private final WaitlistService waitlistService;
    private final ObjectMapper objectMapper;
    private final boolean kafkaEnabled;

    public OutboxPublisher(
            OutboxEventRepository outboxRepository,
            WaitlistService waitlistService,
            ObjectMapper objectMapper,
            @Value("${app.kafka.enabled:false}") boolean kafkaEnabled
    ) {
        this.outboxRepository = outboxRepository;
        this.waitlistService = waitlistService;
        this.objectMapper = objectMapper;
        this.kafkaEnabled = kafkaEnabled;
    }

    @Scheduled(fixedDelay = 3_000)
    @Transactional
    public void pollAndDispatch() {
        List<OutboxEvent> pending = outboxRepository.findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus.PENDING);
        if (pending.isEmpty()) return;

        for (OutboxEvent event : pending) {
            try {
                dispatchEvent(event);
                event.setStatus(OutboxStatus.PUBLISHED);
                event.setPublishedAt(Instant.now());
                event.setLastError(null);
            } catch (Exception ex) {
                int attempts = event.getRetryCount() + 1;
                event.setRetryCount(attempts);
                event.setLastError(ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName());
                if (attempts >= MAX_RETRIES) {
                    event.setStatus(OutboxStatus.FAILED);
                    log.error("Outbox event {} (topic={}) moved to DLQ after {} retries: {}",
                            event.getId(), event.getTopic(), attempts, event.getLastError());
                } else {
                    log.warn("Outbox event {} retry {}/{}: {}", event.getId(), attempts, MAX_RETRIES, event.getLastError());
                }
            }
            outboxRepository.save(event);
        }
    }

    private void dispatchEvent(OutboxEvent event) throws Exception {
        JsonNode envelope = objectMapper.readTree(event.getPayload());
        JsonNode payload = envelope.has("payload") ? envelope.get("payload") : envelope;

        if (KafkaTopics.SEAT_LOCK_EXPIRED.equals(event.getTopic())) {
            UUID eventId = UUID.fromString(payload.get("eventId").asText());
            if (payload.has("tierId") && payload.has("releasedQuantity")) {
                UUID tierId = UUID.fromString(payload.get("tierId").asText());
                int qty = payload.get("releasedQuantity").asInt();
                waitlistService.offerReleasedStandingPasses(eventId, tierId, qty);
            } else {
                List<UUID> seatIds = new ArrayList<>();
                JsonNode arr = payload.get("releasedSeatIds");
                if (arr != null && arr.isArray()) {
                    for (JsonNode n : arr) {
                        seatIds.add(UUID.fromString(n.asText()));
                    }
                }
                waitlistService.offerReleasedSeats(eventId, seatIds);
            }
        } else {
            log.info("[Outbox -> {}] Dispatched aggregate={} id={} (kafkaEnabled={})",
                    event.getTopic(), event.getAggregateType(), event.getAggregateId(), kafkaEnabled);
        }
    }

    @Transactional(readOnly = true)
    public OutboxSummaryResponse getSummary() {
        long pending = outboxRepository.countByStatus(OutboxStatus.PENDING);
        long published = outboxRepository.countByStatus(OutboxStatus.PUBLISHED);
        long failed = outboxRepository.countByStatus(OutboxStatus.FAILED);
        List<OutboxEventResponse> recent = outboxRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
        return new OutboxSummaryResponse(kafkaEnabled, pending, published, failed, recent);
    }

    @Transactional
    @Audited(action = "DLQ_EVENT_REPLAYED", resourceType = "OUTBOX")
    public OutboxEventResponse replayEvent(UUID outboxId) {
        OutboxEvent event = outboxRepository.findById(outboxId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Outbox Event Not Found", "Event does not exist."));
        event.setStatus(OutboxStatus.PENDING);
        event.setRetryCount(0);
        event.setLastError(null);
        event.setDlqReplayedAt(Instant.now());
        event = outboxRepository.save(event);
        return toResponse(event);
    }

    @Transactional
    @Audited(action = "DLQ_REPLAY_ALL", resourceType = "OUTBOX")
    public int replayAllFailed() {
        List<OutboxEvent> failed = outboxRepository.findByStatusOrderByCreatedAtDesc(OutboxStatus.FAILED);
        Instant now = Instant.now();
        for (OutboxEvent ev : failed) {
            ev.setStatus(OutboxStatus.PENDING);
            ev.setRetryCount(0);
            ev.setLastError(null);
            ev.setDlqReplayedAt(now);
        }
        outboxRepository.saveAll(failed);
        return failed.size();
    }

    private OutboxEventResponse toResponse(OutboxEvent e) {
        return new OutboxEventResponse(
                e.getId(),
                e.getAggregateType(),
                e.getAggregateId(),
                e.getTopic(),
                e.getPayload(),
                e.getStatus(),
                e.getRetryCount(),
                e.getLastError(),
                e.getCreatedAt(),
                e.getPublishedAt(),
                e.getDlqReplayedAt()
        );
    }
}

