package com.ticketdrop.gateway.filter;

import com.ticketdrop.events.KafkaTopics;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

/**
 * Edge filter: assigns X-Correlation-Id, enforces Redis-backed anti-bot rate limits,
 * and rejects blacklisted JWTs or banned users before requests ever hit downstream services.
 */
@Component
public class EdgeSecurityAndRateLimitFilter implements GlobalFilter, Ordered {

    private static final long AUTH_LIMIT_PER_MINUTE = 60;
    private static final long DEFAULT_LIMIT_PER_MINUTE = 240;

    private final ReactiveStringRedisTemplate redis;
    private final SecretKey signingKey;

    public EdgeSecurityAndRateLimitFilter(
            ReactiveStringRedisTemplate redis,
            @Value("${app.jwt.secret:${JWT_SECRET:change-me-to-a-very-long-random-256-bit-secret-key-for-ticketdrop-ai-2026}}") String secret
    ) {
        this.redis = redis;
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        String correlationId = exchange.getRequest().getHeaders().getFirst(KafkaTopics.HEADER_CORRELATION_ID);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }

        String clientIp = exchange.getRequest().getRemoteAddress() != null
                ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                : "unknown";
        boolean isAuthRoute = path.startsWith("/api/v1/auth/");
        long limit = isAuthRoute ? AUTH_LIMIT_PER_MINUTE : DEFAULT_LIMIT_PER_MINUTE;
        String rateKey = "ratelimit:" + (isAuthRoute ? "auth:" : "api:") + clientIp;

        final String finalCorrelationId = correlationId;

        return checkRateLimit(rateKey, limit).flatMap(allowed -> {
            if (!allowed) {
                exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                return exchange.getResponse().setComplete();
            }

            String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                try {
                    Claims claims = Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
                    String jti = claims.getId();
                    String userId = claims.getSubject();
                    String role = claims.get("role", String.class);

                    return Mono.zip(
                            redis.hasKey("jwt:blacklist:" + jti),
                            redis.hasKey("user:banned:" + userId)
                    ).flatMap(tuple -> {
                        if (Boolean.TRUE.equals(tuple.getT1()) || Boolean.TRUE.equals(tuple.getT2())) {
                            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                            return exchange.getResponse().setComplete();
                        }
                        ServerHttpRequest mutated = exchange.getRequest().mutate()
                                .header(KafkaTopics.HEADER_CORRELATION_ID, finalCorrelationId)
                                .header(KafkaTopics.HEADER_USER_ID, userId)
                                .header(KafkaTopics.HEADER_USER_ROLE, role != null ? role : "")
                                .build();
                        return chain.filter(exchange.mutate().request(mutated).build());
                    });
                } catch (JwtException ignored) {
                    // Let downstream Spring Security return standard 401/403
                }
            }

            ServerHttpRequest mutated = exchange.getRequest().mutate()
                    .header(KafkaTopics.HEADER_CORRELATION_ID, finalCorrelationId)
                    .build();
            return chain.filter(exchange.mutate().request(mutated).build());
        });
    }

    private Mono<Boolean> checkRateLimit(String key, long limit) {
        return redis.opsForValue().increment(key)
                .flatMap(count -> {
                    if (count != null && count == 1L) {
                        return redis.expire(key, Duration.ofMinutes(1)).thenReturn(true);
                    }
                    return Mono.just(count == null || count <= limit);
                })
                .onErrorReturn(true); // Fail-open if Redis has transient network blip
    }

    @Override
    public int getOrder() {
        return -100;
    }
}

