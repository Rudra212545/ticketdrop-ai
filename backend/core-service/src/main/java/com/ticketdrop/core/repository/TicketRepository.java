package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.Ticket;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface TicketRepository extends JpaRepository<Ticket, UUID> {

    @EntityGraph(attributePaths = {"tier", "booking", "booking.event"})
    List<Ticket> findByOwnerIdOrderByIssuedAtDesc(UUID ownerId);

    @EntityGraph(attributePaths = {"tier"})
    List<Ticket> findByBookingId(UUID bookingId);
}

