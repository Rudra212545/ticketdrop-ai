package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.Ticket;
import com.ticketdrop.core.domain.enums.TicketStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketRepository extends JpaRepository<Ticket, UUID> {

    @EntityGraph(attributePaths = {"tier", "booking", "booking.event"})
    List<Ticket> findByOwnerIdOrderByIssuedAtDesc(UUID ownerId);

    @EntityGraph(attributePaths = {"tier"})
    List<Ticket> findByBookingId(UUID bookingId);

    @EntityGraph(attributePaths = {"tier", "owner", "booking", "booking.event", "booking.event.organizer"})
    Optional<Ticket> findByQrTokenId(UUID qrTokenId);

    @EntityGraph(attributePaths = {"tier", "owner", "booking", "booking.event"})
    Optional<Ticket> findWithDetailsById(UUID id);

    @EntityGraph(attributePaths = {"tier", "booking", "booking.event"})
    List<Ticket> findByBookingEventIdAndStatusIn(UUID eventId, List<TicketStatus> statuses);

    long countByBookingEventId(UUID eventId);
}

