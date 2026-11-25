package com.ticketdrop.core.domain.entity;

import com.ticketdrop.core.domain.enums.EventStatus;
import com.ticketdrop.core.domain.enums.SeatingMode;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "events")
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organizer_id", nullable = false)
    private OrganizerProfile organizer;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 64)
    private String category;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(name = "venue_name", nullable = false, length = 200)
    private String venueName;

    @Column(name = "event_start_at", nullable = false)
    private Instant eventStartAt;

    @Column(name = "flash_sale_enabled", nullable = false)
    private boolean flashSaleEnabled = false;

    @Column(name = "flash_sale_start_at")
    private Instant flashSaleStartAt;

    @Column(name = "resale_enabled", nullable = false)
    private boolean resaleEnabled = true;

    @Column(name = "max_resale_multiplier", nullable = false, precision = 3, scale = 2)
    private BigDecimal maxResaleMultiplier = new BigDecimal("1.10");

    @Enumerated(EnumType.STRING)
    @Column(name = "seating_mode", nullable = false, length = 32)
    private SeatingMode seatingMode = SeatingMode.ASSIGNED_SEAT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EventStatus status = EventStatus.DRAFT;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public OrganizerProfile getOrganizer() { return organizer; }
    public void setOrganizer(OrganizerProfile organizer) { this.organizer = organizer; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getVenueName() { return venueName; }
    public void setVenueName(String venueName) { this.venueName = venueName; }
    public Instant getEventStartAt() { return eventStartAt; }
    public void setEventStartAt(Instant eventStartAt) { this.eventStartAt = eventStartAt; }
    public boolean isFlashSaleEnabled() { return flashSaleEnabled; }
    public void setFlashSaleEnabled(boolean flashSaleEnabled) { this.flashSaleEnabled = flashSaleEnabled; }
    public Instant getFlashSaleStartAt() { return flashSaleStartAt; }
    public void setFlashSaleStartAt(Instant flashSaleStartAt) { this.flashSaleStartAt = flashSaleStartAt; }
    public boolean isResaleEnabled() { return resaleEnabled; }
    public void setResaleEnabled(boolean resaleEnabled) { this.resaleEnabled = resaleEnabled; }
    public BigDecimal getMaxResaleMultiplier() { return maxResaleMultiplier; }
    public void setMaxResaleMultiplier(BigDecimal maxResaleMultiplier) { this.maxResaleMultiplier = maxResaleMultiplier; }
    public SeatingMode getSeatingMode() { return seatingMode; }
    public void setSeatingMode(SeatingMode seatingMode) { this.seatingMode = seatingMode; }
    public EventStatus getStatus() { return status; }
    public void setStatus(EventStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

