package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.ResaleListing;
import com.ticketdrop.core.domain.enums.ResaleStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ResaleListingRepository extends JpaRepository<ResaleListing, UUID> {

    @EntityGraph(attributePaths = {"ticket", "ticket.tier", "event", "seller"})
    List<ResaleListing> findByStatusOrderByCreatedAtDesc(ResaleStatus status);

    @EntityGraph(attributePaths = {"ticket", "ticket.tier", "event", "seller"})
    List<ResaleListing> findByEventIdAndStatusOrderByAskingPricePaiseAsc(UUID eventId, ResaleStatus status);

    @EntityGraph(attributePaths = {"ticket", "ticket.tier", "event", "seller"})
    List<ResaleListing> findBySellerIdOrderByCreatedAtDesc(UUID sellerId);

    @EntityGraph(attributePaths = {"ticket", "ticket.tier", "event", "seller"})
    Optional<ResaleListing> findWithDetailsById(UUID id);

    boolean existsByTicketIdAndStatus(UUID ticketId, ResaleStatus status);
}

