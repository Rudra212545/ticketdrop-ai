package com.ticketdrop.core.domain.entity;

import com.ticketdrop.core.domain.enums.ResaleStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "resale_listings")
public class ResaleListing {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false)
    private Ticket ticket;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seller_id", nullable = false)
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "buyer_id")
    private User buyer;

    @Column(name = "original_price_paise", nullable = false)
    private long originalPricePaise;

    @Column(name = "asking_price_paise", nullable = false)
    private long askingPricePaise;

    @Column(name = "max_allowed_price_paise", nullable = false)
    private long maxAllowedPricePaise;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ResaleStatus status = ResaleStatus.ACTIVE;

    @Version
    @Column(nullable = false)
    private long version = 0L;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "sold_at")
    private Instant soldAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Ticket getTicket() { return ticket; }
    public void setTicket(Ticket ticket) { this.ticket = ticket; }
    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }
    public User getSeller() { return seller; }
    public void setSeller(User seller) { this.seller = seller; }
    public User getBuyer() { return buyer; }
    public void setBuyer(User buyer) { this.buyer = buyer; }
    public long getOriginalPricePaise() { return originalPricePaise; }
    public void setOriginalPricePaise(long originalPricePaise) { this.originalPricePaise = originalPricePaise; }
    public long getAskingPricePaise() { return askingPricePaise; }
    public void setAskingPricePaise(long askingPricePaise) { this.askingPricePaise = askingPricePaise; }
    public long getMaxAllowedPricePaise() { return maxAllowedPricePaise; }
    public void setMaxAllowedPricePaise(long maxAllowedPricePaise) { this.maxAllowedPricePaise = maxAllowedPricePaise; }
    public ResaleStatus getStatus() { return status; }
    public void setStatus(ResaleStatus status) { this.status = status; }
    public long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getSoldAt() { return soldAt; }
    public void setSoldAt(Instant soldAt) { this.soldAt = soldAt; }
}

