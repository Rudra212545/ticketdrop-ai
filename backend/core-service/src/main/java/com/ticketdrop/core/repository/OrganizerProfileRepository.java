package com.ticketdrop.core.repository;

import com.ticketdrop.core.domain.entity.OrganizerProfile;
import com.ticketdrop.core.domain.enums.ApprovalStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrganizerProfileRepository extends JpaRepository<OrganizerProfile, UUID> {

    @EntityGraph(attributePaths = "user")
    Optional<OrganizerProfile> findByUserId(UUID userId);

    @EntityGraph(attributePaths = "user")
    List<OrganizerProfile> findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus status);

    @EntityGraph(attributePaths = "user")
    List<OrganizerProfile> findAllByOrderByCreatedAtDesc();
}

