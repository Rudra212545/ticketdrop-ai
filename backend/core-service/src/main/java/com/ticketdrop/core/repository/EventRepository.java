package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.Event;
import com.ticketdrop.core.domain.enums.EventStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EventRepository extends JpaRepository<Event, UUID> {

    @EntityGraph(attributePaths = "organizer")
    List<Event> findByStatusOrderByEventStartAtAsc(EventStatus status);

    @EntityGraph(attributePaths = "organizer")
    List<Event> findByOrganizerIdOrderByCreatedAtDesc(UUID organizerId);

    @EntityGraph(attributePaths = "organizer")
    Optional<Event> findWithOrganizerById(UUID id);

    List<Event> findByStatusInAndEventStartAtBefore(List<EventStatus> statuses, Instant cutoff);
}

