package com.ticketdrop.core.security;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public class RedisTokenService {

    private static final String REFRESH_PREFIX = "jwt:refresh:";
    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";
    private static final String BANNED_PREFIX = "user:banned:";

    private final StringRedisTemplate redis;

    public RedisTokenService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void storeRefreshToken(UUID userId, String jti, Duration ttl) {
        redis.opsForValue().set(refreshKey(userId, jti), "1", ttl);
    }

    public boolean isRefreshTokenValid(UUID userId, String jti) {
        return Boolean.TRUE.equals(redis.hasKey(refreshKey(userId, jti)));
    }

    public void revokeRefreshToken(UUID userId, String jti) {
        redis.delete(refreshKey(userId, jti));
    }

    public void blacklistAccessToken(String jti, Instant expiresAt) {
        Duration remaining = Duration.between(Instant.now(), expiresAt);
        if (!remaining.isNegative() && !remaining.isZero()) {
            redis.opsForValue().set(BLACKLIST_PREFIX + jti, "1", remaining);
        }
    }

    public boolean isAccessTokenBlacklisted(String jti) {
        return Boolean.TRUE.equals(redis.hasKey(BLACKLIST_PREFIX + jti));
    }

    public void markUserBanned(UUID userId) {
        redis.opsForValue().set(BANNED_PREFIX + userId, "1", Duration.ofDays(30));
    }

    public void unbanUser(UUID userId) {
        redis.delete(BANNED_PREFIX + userId);
    }

    public boolean isUserBanned(UUID userId) {
        return Boolean.TRUE.equals(redis.hasKey(BANNED_PREFIX + userId));
    }

    private String refreshKey(UUID userId, String jti) {
        return REFRESH_PREFIX + userId + ":" + jti;
    }
}

