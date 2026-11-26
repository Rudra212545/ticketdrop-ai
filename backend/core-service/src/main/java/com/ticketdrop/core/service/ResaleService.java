package com.ticketdrop.core.service;

import com.ticketdrop.core.audit.Audited;
import com.ticketdrop.core.domain.entity.*;
import com.ticketdrop.core.domain.enums.EventStatus;
import com.ticketdrop.core.domain.enums.ResaleStatus;
import com.ticketdrop.core.domain.enums.TicketStatus;
import com.ticketdrop.core.dto.Phase3Dtos.CreateResaleRequest;
import com.ticketdrop.core.dto.Phase3Dtos.ResaleListingResponse;
import com.ticketdrop.core.exception.ApiException;
import com.ticketdrop.core.repository.ResaleListingRepository;
import com.ticketdrop.core.repository.TicketRepository;
import com.ticketdrop.core.repository.UserRepository;
import com.ticketdrop.events.KafkaTopics;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Anti-Scalper Price-Capped Resale Escrow Saga:
 * - Enforces organizer's max_resale_multiplier (e.g. 110% of face value).
 * - Atomically transfers ownership with JPA @Version optimistic locking.
 * - Immediately revokes seller's old QR token in Redis (`qr:revoked:{oldQrTokenId}`)
 *   and mints a freshly signed HMAC-SHA256 QR token for the buyer.
 */
@Service
public class ResaleService {

    private final ResaleListingRepository resaleRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final QrSigningService qrSigningService;
    private final OutboxService outboxService;
    private final StringRedisTemplate redisTemplate;

    public ResaleService(
            ResaleListingRepository resaleRepository,
            TicketRepository ticketRepository,
            UserRepository userRepository,
            QrSigningService qrSigningService,
            OutboxService outboxService,
            StringRedisTemplate redisTemplate
    ) {
        this.resaleRepository = resaleRepository;
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.qrSigningService = qrSigningService;
        this.outboxService = outboxService;
        this.redisTemplate = redisTemplate;
    }

    @Transactional(readOnly = true)
    public List<ResaleListingResponse> listActiveListings(UUID eventId) {
        List<ResaleListing> list = (eventId != null)
                ? resaleRepository.findByEventIdAndStatusOrderByAskingPricePaiseAsc(eventId, ResaleStatus.ACTIVE)
                : resaleRepository.findByStatusOrderByCreatedAtDesc(ResaleStatus.ACTIVE);
        return list.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ResaleListingResponse> listMyListings(UUID sellerId) {
        return resaleRepository.findBySellerIdOrderByCreatedAtDesc(sellerId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    @Audited(action = "RESALE_LISTED", resourceType = "RESALE")
    public ResaleListingResponse createListing(UUID sellerId, CreateResaleRequest req) {
        Ticket ticket = ticketRepository.findWithDetailsById(req.ticketId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Ticket Not Found", "Ticket does not exist."));
        if (!ticket.getOwner().getId().equals(sellerId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not Ticket Owner", "You can only list your own passes for resale.");
        }
        if (ticket.getStatus() != TicketStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "Ticket Not Eligible", "Only ACTIVE passes can be listed for resale.");
        }
        if (resaleRepository.existsByTicketIdAndStatus(ticket.getId(), ResaleStatus.ACTIVE)) {
            throw new ApiException(HttpStatus.CONFLICT, "Already Listed", "This pass is already listed on the resale marketplace.");
        }

        Event event = ticket.getBooking().getEvent();
        if (!event.isResaleEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Resale Disabled", "The organizer has disabled resale for this event.");
        }
        if (event.getStatus() != EventStatus.PUBLISHED && event.getStatus() != EventStatus.SOLD_OUT) {
            throw new ApiException(HttpStatus.CONFLICT, "Event Closed", "Resale is closed because this event is no longer active.");
        }

        long originalPrice = ticket.getTier() != null ? ticket.getTier().getBasePricePaise() : 0L;
        BigDecimal multiplier = event.getMaxResaleMultiplier() != null ? event.getMaxResaleMultiplier() : new BigDecimal("1.10");
        long maxAllowed = BigDecimal.valueOf(originalPrice)
                .multiply(multiplier)
                .setScale(0, RoundingMode.FLOOR)
                .longValue();

        if (req.askingPricePaise() > maxAllowed) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Exceeds Anti-Scalper Price Cap",
                    "Asking price exceeds the organizer's strict cap of ₹" + (maxAllowed / 100) +
                            " (" + multiplier.multiply(BigDecimal.valueOf(100)).intValue() + "% of face value)."
            );
        }

        ticket.setStatus(TicketStatus.RESALE_LISTED);
        ticketRepository.save(ticket);

        ResaleListing listing = new ResaleListing();
        listing.setTicket(ticket);
        listing.setEvent(event);
        listing.setSeller(ticket.getOwner());
        listing.setOriginalPricePaise(originalPrice);
        listing.setAskingPricePaise(req.askingPricePaise());
        listing.setMaxAllowedPricePaise(maxAllowed);
        listing.setStatus(ResaleStatus.ACTIVE);
        listing = resaleRepository.save(listing);

        return toResponse(listing);
    }

    @Transactional
    @Audited(action = "RESALE_CANCELLED", resourceType = "RESALE")
    public void cancelListing(UUID listingId, UUID sellerId) {
        ResaleListing listing = resaleRepository.findWithDetailsById(listingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Listing Not Found", "Resale listing does not exist."));
        if (!listing.getSeller().getId().equals(sellerId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Forbidden", "You can only cancel your own resale listing.");
        }
        if (listing.getStatus() != ResaleStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "Listing Closed", "This listing is no longer active.");
        }
        listing.setStatus(ResaleStatus.CANCELLED);
        resaleRepository.save(listing);

        Ticket ticket = listing.getTicket();
        ticket.setStatus(TicketStatus.ACTIVE);
        ticketRepository.save(ticket);
    }

    @Transactional
    @Audited(action = "RESALE_PURCHASED", resourceType = "RESALE")
    public ResaleListingResponse purchaseListing(UUID listingId, UUID buyerId) {
        try {
            ResaleListing listing = resaleRepository.findWithDetailsById(listingId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Listing Not Found", "Resale listing does not exist."));
            if (listing.getStatus() != ResaleStatus.ACTIVE) {
                throw new ApiException(HttpStatus.CONFLICT, "Already Sold", "This resale ticket was just claimed by another fan.");
            }
            if (listing.getSeller().getId().equals(buyerId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Cannot Buy Own Ticket", "You cannot purchase your own resale listing.");
            }

            User buyer = userRepository.findById(buyerId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User Not Found", "Buyer account not found."));

            Ticket ticket = listing.getTicket();
            UUID oldQrTokenId = ticket.getQrTokenId();

            // 1. Revoke seller's QR token immediately in Redis so old screenshots fail at gate
            redisTemplate.opsForValue().set("qr:revoked:" + oldQrTokenId, "RESALE_TRANSFERRED", Duration.ofDays(30));

            // 2. Atomic ownership transfer + cryptographic QR rotation
            UUID newQrTokenId = UUID.randomUUID();
            String resourceId = ticket.getSeat() != null
                    ? ticket.getSeat().getId().toString()
                    : (ticket.getTier() != null ? ticket.getTier().getId().toString() : ticket.getId().toString());
            ticket.setOwner(buyer);
            ticket.setQrTokenId(newQrTokenId);
            ticket.setQrSignature(qrSigningService.sign(newQrTokenId, resourceId, buyer.getId()));
            ticket.setStatus(TicketStatus.ACTIVE);
            ticketRepository.save(ticket);

            // 3. Complete Escrow Listing
            listing.setBuyer(buyer);
            listing.setStatus(ResaleStatus.SOLD);
            listing.setSoldAt(Instant.now());
            listing = resaleRepository.saveAndFlush(listing);

            // 4. Emit Transactional Outbox event
            outboxService.enqueue(
                    "RESALE",
                    listing.getId(),
                    KafkaTopics.RESALE_COMPLETED,
                    "RESALE_COMPLETED",
                    Map.of(
                            "listingId", listing.getId(),
                            "ticketId", ticket.getId(),
                            "eventId", listing.getEvent().getId(),
                            "sellerId", listing.getSeller().getId(),
                            "buyerId", buyer.getId(),
                            "pricePaise", listing.getAskingPricePaise(),
                            "revokedQrTokenId", oldQrTokenId,
                            "newQrTokenId", newQrTokenId
                    )
            );

            return toResponse(listing);
        } catch (OptimisticLockingFailureException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "Concurrent Purchase", "Another fan just bought this resale pass.");
        }
    }

    private ResaleListingResponse toResponse(ResaleListing r) {
        Ticket t = r.getTicket();
        Event ev = r.getEvent();
        return new ResaleListingResponse(
                r.getId(),
                t.getId(),
                ev.getId(),
                ev.getTitle(),
                ev.getVenueName(),
                ev.getCity(),
                ev.getEventStartAt(),
                t.getTier() != null ? t.getTier().getName() : "General",
                t.getPassLabel() != null ? t.getPassLabel() : "PASS",
                r.getSeller().getId(),
                r.getSeller().getFullName(),
                r.getOriginalPricePaise(),
                r.getAskingPricePaise(),
                r.getMaxAllowedPricePaise(),
                r.getStatus(),
                r.getCreatedAt(),
                r.getSoldAt()
        );
    }
}

