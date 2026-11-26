package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.StandingHold;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StandingHoldRepository extends JpaRepository<StandingHold, UUID> {

    @EntityGraph(attributePaths = {"tier", "event"})
    List<StandingHold> findByBookingId(UUID bookingId);

    @EntityGraph(attributePaths = {"tier", "event"})
    List<StandingHold> findByStatusAndExpiresAtBefore(String status, Instant cutoff);

    @EntityGraph(attributePaths = {"tier", "event"})
    Optional<StandingHold> findFirstByEventIdAndTierIdAndUserIdAndStatusAndBookingIdIsNullOrderByCreatedAtDesc(
            UUID eventId, UUID tierId, UUID userId, String status
    );
}

