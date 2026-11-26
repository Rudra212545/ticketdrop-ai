package com.ticketdrop.core.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.UUID;

/**
 * Cryptographic HMAC-SHA256 QR token signer & verifier shared across
 * Booking minting, Anti-Scalper Resale QR rotation, and Venue Gate Scanner.
 */
@Service
public class QrSigningService {

    private final String qrSigningSecret;

    public QrSigningService(@Value("${app.jwt.secret}") String qrSigningSecret) {
        this.qrSigningSecret = qrSigningSecret;
    }

    public String sign(UUID qrTokenId, String resourceId, UUID ownerId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(qrSigningSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal((qrTokenId + ":" + resourceId + ":" + ownerId).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to sign QR payload", ex);
        }
    }

    public boolean verify(UUID qrTokenId, String resourceId, UUID ownerId, String providedSignature) {
        if (providedSignature == null || providedSignature.isBlank()) return false;
        String expected = sign(qrTokenId, resourceId, ownerId);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                providedSignature.getBytes(StandardCharsets.UTF_8)
        );
    }
}

