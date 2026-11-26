package com.ticketdrop.core.domain.entity;

import com.ticketdrop.core.domain.enums.WaitlistStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "waitlist_entries")
public class WaitlistEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tier_id", nullable = false)
    private SeatTier tier;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private WaitlistStatus status = WaitlistStatus.WAITING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offered_seat_id")
    private Seat offeredSeat;

    @Column(name = "offer_expires_at")
    private Instant offerExpiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }
    public SeatTier getTier() { return tier; }
    public void setTier(SeatTier tier) { this.tier = tier; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public WaitlistStatus getStatus() { return status; }
    public void setStatus(WaitlistStatus status) { this.status = status; }
    public Seat getOfferedSeat() { return offeredSeat; }
    public void setOfferedSeat(Seat offeredSeat) { this.offeredSeat = offeredSeat; }
    public Instant getOfferExpiresAt() { return offerExpiresAt; }
    public void setOfferExpiresAt(Instant offerExpiresAt) { this.offerExpiresAt = offerExpiresAt; }
    public Instant getCreatedAt() { return createdAt; }
}

