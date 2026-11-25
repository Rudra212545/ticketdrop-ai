package com.ticketdrop.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Real-time SSE broadcaster pushing instant seat-map invalidations (<50ms)
 * to all connected fans whenever any seat is locked, booked, or released.
 */
@Service
public class SeatMapBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(SeatMapBroadcaster.class);
    private final Map<UUID, CopyOnWriteArrayList<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    public SseEmitter subscribe(UUID eventId) {
        SseEmitter emitter = new SseEmitter(0L); // No timeout; client auto-reconnects
        var list = subscribers.computeIfAbsent(eventId, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        Runnable cleanup = () -> {
            list.remove(emitter);
            if (list.isEmpty()) {
                subscribers.remove(eventId, list);
            }
        };
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> cleanup.run());

        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException ex) {
            cleanup.run();
        }
        return emitter;
    }

    public void broadcastSeatChange(UUID eventId, String reason) {
        var list = subscribers.get(eventId);
        if (list == null || list.isEmpty()) {
            return;
        }
        String payload = "{\"eventId\":\"" + eventId + "\",\"reason\":\"" + reason + "\",\"at\":\"" + Instant.now() + "\"}";
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name("seat-update").data(payload));
            } catch (Exception ex) {
                list.remove(emitter);
                log.debug("Removed stale SSE subscriber for event {}", eventId);
            }
        }
    }
}

