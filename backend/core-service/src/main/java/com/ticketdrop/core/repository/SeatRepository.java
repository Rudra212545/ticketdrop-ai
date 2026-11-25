package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.Seat;
import com.ticketdrop.core.domain.enums.SeatStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SeatRepository extends JpaRepository<Seat, UUID> {

    @EntityGraph(attributePaths = "tier")
    List<Seat> findByEventIdOrderByRowLabelAscSeatNumberAsc(UUID eventId);

    @EntityGraph(attributePaths = "tier")
    List<Seat> findByIdInAndEventId(List<UUID> ids, UUID eventId);

    @EntityGraph(attributePaths = {"tier", "event"})
    List<Seat> findByStatusAndLockedUntilBefore(SeatStatus status, Instant cutoff);

    @EntityGraph(attributePaths = "tier")
    List<Seat> findByEventIdAndLockedByAndStatus(UUID eventId, UUID lockedBy, SeatStatus status);
}

