package com.ticketdrop.core.domain.entity;

import com.ticketdrop.core.domain.enums.TicketStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tickets")
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id")
    private Seat seat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tier_id")
    private SeatTier tier;

    @Column(name = "pass_label", length = 64)
    private String passLabel;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "qr_token_id", nullable = false, unique = true)
    private UUID qrTokenId;

    @Column(name = "qr_signature", nullable = false)
    private String qrSignature;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TicketStatus status = TicketStatus.ACTIVE;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private Instant issuedAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @PrePersist
    void onCreate() {
        if (this.qrTokenId == null) {
            this.qrTokenId = UUID.randomUUID();
        }
        this.issuedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public Booking getBooking() { return booking; }
    public void setBooking(Booking booking) { this.booking = booking; }
    public Seat getSeat() { return seat; }
    public void setSeat(Seat seat) { this.seat = seat; }
    public SeatTier getTier() { return tier; }
    public void setTier(SeatTier tier) { this.tier = tier; }
    public String getPassLabel() { return passLabel; }
    public void setPassLabel(String passLabel) { this.passLabel = passLabel; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
    public UUID getQrTokenId() { return qrTokenId; }
    public void setQrTokenId(UUID qrTokenId) { this.qrTokenId = qrTokenId; }
    public String getQrSignature() { return qrSignature; }
    public void setQrSignature(String qrSignature) { this.qrSignature = qrSignature; }
    public TicketStatus getStatus() { return status; }
    public void setStatus(TicketStatus status) { this.status = status; }
    public Instant getIssuedAt() { return issuedAt; }
    public Instant getUsedAt() { return usedAt; }
    public void setUsedAt(Instant usedAt) { this.usedAt = usedAt; }
}

