package com.ticketdrop.core.domain.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "seat_tiers")
public class SeatTier {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "base_price_paise", nullable = false)
    private long basePricePaise;

    @Column(name = "total_seats", nullable = false)
    private int totalSeats;

    @Column(name = "available_seats", nullable = false)
    private int availableSeats;

    @Column(name = "color_code", nullable = false, length = 32)
    private String colorCode = "VIOLET";

    @Version
    @Column(nullable = false)
    private long version = 0L;

    public UUID getId() { return id; }
    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public long getBasePricePaise() { return basePricePaise; }
    public void setBasePricePaise(long basePricePaise) { this.basePricePaise = basePricePaise; }
    public int getTotalSeats() { return totalSeats; }
    public void setTotalSeats(int totalSeats) { this.totalSeats = totalSeats; }
    public int getAvailableSeats() { return availableSeats; }
    public void setAvailableSeats(int availableSeats) { this.availableSeats = availableSeats; }
    public String getColorCode() { return colorCode; }
    public void setColorCode(String colorCode) { this.colorCode = colorCode; }
    public long getVersion() { return version; }
}

