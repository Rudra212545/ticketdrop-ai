package com.ticketdrop.core.security;

import com.ticketdrop.core.domain.enums.Role;
import java.util.UUID;

public record UserPrincipal(
        UUID id,
        String email,
        Role role,
        String jti
) {}

