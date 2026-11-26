package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.Booking;
import com.ticketdrop.core.domain.enums.BookingStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BookingRepository extends JpaRepository<Booking, UUID> {

    @EntityGraph(attributePaths = "event")
    Optional<Booking> findByIdempotencyKey(String idempotencyKey);

    @EntityGraph(attributePaths = "event")
    Optional<Booking> findWithEventById(UUID id);

    @EntityGraph(attributePaths = "event")
    List<Booking> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Booking> findByStatusAndExpiresAtBefore(BookingStatus status, Instant cutoff);

    List<Booking> findByEventIdAndStatusIn(UUID eventId, List<BookingStatus> statuses);

    long countByEventId(UUID eventId);
}

