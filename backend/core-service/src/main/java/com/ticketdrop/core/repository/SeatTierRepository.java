package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.SeatTier;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface SeatTierRepository extends JpaRepository<SeatTier, UUID> {
    List<SeatTier> findByEventIdOrderByBasePricePaiseDesc(UUID eventId);
}

