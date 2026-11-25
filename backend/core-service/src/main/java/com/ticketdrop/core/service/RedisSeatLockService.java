package com.ticketdrop.core.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Distributed Seat Locking (sorted multi-lock with Lua compare-and-delete rollback)
 * and Flash-Sale Virtual Waiting Room backed by Redis 7.
 */
@Service
public class RedisSeatLockService {

    public static final Duration SEAT_LOCK_TTL = Duration.ofMinutes(10);
    private static final Duration ADMISSION_TTL = Duration.ofMinutes(10);
    private static final long MAX_CONCURRENT_ADMITTED = 50;

    private static final DefaultRedisScript<Long> RELEASE_IF_OWNER_SCRIPT = new DefaultRedisScript<>(
            "local v = redis.call('GET', KEYS[1]); " +
            "if v and string.sub(v, 1, #ARGV[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
            Long.class
    );

    private static final DefaultRedisScript<Long> RESERVE_STANDING_SCRIPT = new DefaultRedisScript<>(
            "local avail = redis.call('GET', KEYS[1]); " +
            "if not avail then redis.call('SET', KEYS[1], ARGV[2]); avail = ARGV[2] end; " +
            "if tonumber(avail) >= tonumber(ARGV[1]) then redis.call('DECRBY', KEYS[1], ARGV[1]); return 1 else return 0 end",
            Long.class
    );

    private static final DefaultRedisScript<Long> RELEASE_STANDING_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('EXISTS', KEYS[1]) == 1 then return redis.call('INCRBY', KEYS[1], ARGV[1]) else return 0 end",
            Long.class
    );

    private final StringRedisTemplate redis;

    public RedisSeatLockService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Atomically locks all requested seats (lexicographically sorted to prevent deadlocks).
     * If any seat is already locked by another user, rolls back all acquired locks immediately.
     */
    public String tryAcquireSeatLocks(UUID eventId, List<UUID> seatIds, UUID userId) {
        List<UUID> sorted = new ArrayList<>(seatIds);
        sorted.sort(Comparator.comparing(UUID::toString));

        String lockToken = UUID.randomUUID().toString();
        String ownerValue = userId + ":" + lockToken;
        List<String> acquiredKeys = new ArrayList<>();

        for (UUID seatId : sorted) {
            String key = seatLockKey(eventId, seatId);
            Boolean locked = redis.opsForValue().setIfAbsent(key, ownerValue, SEAT_LOCK_TTL);
            if (Boolean.TRUE.equals(locked)) {
                acquiredKeys.add(key);
            } else {
                // Allow idempotent re-lock by the exact same user
                String existing = redis.opsForValue().get(key);
                if (existing != null && existing.startsWith(userId + ":")) {
                    redis.expire(key, SEAT_LOCK_TTL);
                } else {
                    // Roll back every key acquired in this batch
                    for (String acquired : acquiredKeys) {
                        redis.execute(RELEASE_IF_OWNER_SCRIPT, Collections.singletonList(acquired), userId + ":");
                    }
                    return null;
                }
            }
        }
        return lockToken;
    }

    public boolean verifyUserOwnsAllLocks(UUID eventId, List<UUID> seatIds, UUID userId) {
        for (UUID seatId : seatIds) {
            String val = redis.opsForValue().get(seatLockKey(eventId, seatId));
            if (val == null || !val.startsWith(userId + ":")) {
                return false;
            }
        }
        return true;
    }

    public void releaseSeatLocks(UUID eventId, List<UUID> seatIds, UUID userId) {
        for (UUID seatId : seatIds) {
            redis.execute(
                    RELEASE_IF_OWNER_SCRIPT,
                    Collections.singletonList(seatLockKey(eventId, seatId)),
                    userId + ":"
            );
        }
    }

    public QueueState joinOrCheckWaitingRoom(UUID eventId, UUID userId) {
        String admitKey = admissionKey(eventId, userId);
        String existingToken = redis.opsForValue().get(admitKey);
        String queueKey = queueKey(eventId);
        Long total = redis.opsForZSet().zCard(queueKey);

        if (existingToken != null) {
            return new QueueState(true, 0, total != null ? total : 0, existingToken);
        }

        String member = userId.toString();
        Double existingScore = redis.opsForZSet().score(queueKey, member);
        if (existingScore == null) {
            redis.opsForZSet().add(queueKey, member, (double) Instant.now().toEpochMilli());
            redis.expire(queueKey, Duration.ofHours(2));
        }

        Long rank = redis.opsForZSet().rank(queueKey, member);
        total = redis.opsForZSet().zCard(queueKey);
        long pos = rank != null ? rank + 1 : 1;

        if (pos <= MAX_CONCURRENT_ADMITTED) {
            String token = UUID.randomUUID().toString();
            redis.opsForValue().set(admitKey, token, ADMISSION_TTL);
            redis.opsForZSet().remove(queueKey, member);
            return new QueueState(true, 0, total != null ? total : 1, token);
        }

        return new QueueState(false, pos, total != null ? total : pos, null);
    }

    public boolean isAdmittedToFlashSale(UUID eventId, UUID userId) {
        return Boolean.TRUE.equals(redis.hasKey(admissionKey(eventId, userId)));
    }

    /**
     * Atomically reserves standing-zone passes via Redis Lua DECRBY (zero overselling under spike).
     */
    public boolean tryReserveStandingPasses(UUID tierId, int dbAvailable, int quantity) {
        Long ok = redis.execute(
                RESERVE_STANDING_SCRIPT,
                Collections.singletonList(zoneAvailKey(tierId)),
                String.valueOf(quantity),
                String.valueOf(dbAvailable)
        );
        return ok != null && ok == 1L;
    }

    public void releaseStandingPasses(UUID tierId, int quantity) {
        redis.execute(
                RELEASE_STANDING_SCRIPT,
                Collections.singletonList(zoneAvailKey(tierId)),
                String.valueOf(quantity)
        );
    }

    public void seedStandingAvailability(UUID tierId, int available) {
        redis.opsForValue().set(zoneAvailKey(tierId), String.valueOf(available));
    }

    private String seatLockKey(UUID eventId, UUID seatId) {
        return "seat:lock:" + eventId + ":" + seatId;
    }

    private String zoneAvailKey(UUID tierId) {
        return "zone:avail:" + tierId;
    }

    private String queueKey(UUID eventId) {
        return "queue:flash:" + eventId;
    }

    private String admissionKey(UUID eventId, UUID userId) {
        return "queue:admit:" + eventId + ":" + userId;
    }

    public record QueueState(boolean admitted, long position, long totalInQueue, String admissionToken) {}
}

