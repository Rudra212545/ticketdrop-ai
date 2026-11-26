package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.OutboxEvent;
import com.ticketdrop.core.domain.enums.OutboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {
    List<OutboxEvent> findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus status);
    List<OutboxEvent> findTop50ByOrderByCreatedAtDesc();
    List<OutboxEvent> findByStatusOrderByCreatedAtDesc(OutboxStatus status);
    long countByStatus(OutboxStatus status);
}

