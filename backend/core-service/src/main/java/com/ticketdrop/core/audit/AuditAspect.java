package com.ticketdrop.core.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketdrop.core.domain.entity.AuditLog;
import com.ticketdrop.core.repository.AuditLogRepository;
import com.ticketdrop.core.security.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Aspect
@Component
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditAspect(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    @AfterReturning(pointcut = "@annotation(audited)", returning = "result")
    public void logPrivilegedAction(JoinPoint joinPoint, Audited audited, Object result) {
        try {
            AuditLog entry = new AuditLog();
            entry.setAction(audited.action());
            entry.setResourceType(audited.resourceType());

            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
                entry.setActorId(principal.id());
                entry.setActorRole(principal.role().name());
            }

            if (joinPoint.getArgs().length > 0 && joinPoint.getArgs()[0] != null) {
                entry.setResourceId(joinPoint.getArgs()[0].toString());
            }

            if (result != null) {
                entry.setNewState(objectMapper.writeValueAsString(result));
            }

            if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
                HttpServletRequest req = attrs.getRequest();
                String forwarded = req.getHeader("X-Forwarded-For");
                entry.setIpAddress(forwarded != null ? forwarded.split(",")[0].trim() : req.getRemoteAddr());
            }

            auditLogRepository.save(entry);
        } catch (Exception ex) {
            log.warn("Failed to record audit log for action {}: {}", audited.action(), ex.getMessage());
        }
    }
}

