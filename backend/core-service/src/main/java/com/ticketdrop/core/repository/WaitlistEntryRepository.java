package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.WaitlistEntry;
import com.ticketdrop.core.domain.enums.WaitlistStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WaitlistEntryRepository extends JpaRepository<WaitlistEntry, UUID> {

    @EntityGraph(attributePaths = {"event", "tier", "offeredSeat"})
    List<WaitlistEntry> findByUserIdAndStatusInOrderByCreatedAtDesc(UUID userId, List<WaitlistStatus> statuses);

    @EntityGraph(attributePaths = {"event", "tier", "user", "offeredSeat"})
    Optional<WaitlistEntry> findFirstByEventIdAndTierIdAndStatusOrderByCreatedAtAsc(
            UUID eventId, UUID tierId, WaitlistStatus status
    );

    @EntityGraph(attributePaths = {"event", "tier", "user", "offeredSeat"})
    Optional<WaitlistEntry> findById(UUID id);

    boolean existsByEventIdAndTierIdAndUserIdAndStatusIn(
            UUID eventId, UUID tierId, UUID userId, List<WaitlistStatus> statuses
    );

    long countByEventIdAndTierIdAndStatus(UUID eventId, UUID tierId, WaitlistStatus status);

    @EntityGraph(attributePaths = {"event", "tier", "user", "offeredSeat"})
    List<WaitlistEntry> findByStatusAndOfferExpiresAtBefore(WaitlistStatus status, Instant cutoff);
}

