package com.ticketdrop.events;

/**
 * Central Kafka topic names and shared header constants.
 */
public final class KafkaTopics {
    private KafkaTopics() {}

    public static final String EVENT_PUBLISHED = "event.published";
    public static final String SEAT_LOCK_EXPIRED = "seat.lock.expired";
    public static final String BOOKING_CONFIRMED = "booking.confirmed";
    public static final String RESALE_COMPLETED = "resale.completed";
    public static final String WAITLIST_SEAT_OFFERED = "waitlist.seat.offered";

    public static final String HEADER_CORRELATION_ID = "X-Correlation-Id";
    public static final String HEADER_USER_ID = "X-User-Id";
    public static final String HEADER_USER_ROLE = "X-User-Role";
}

