package com.ticketdrop.core.config;

import com.ticketdrop.core.domain.entity.User;
import com.ticketdrop.core.domain.enums.Role;
import com.ticketdrop.core.domain.enums.UserStatus;
import com.ticketdrop.core.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class SuperAdminSeeder {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminSeeder.class);

    @Bean
    CommandLineRunner seedDefaultSuperAdmin(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            String email = "superadmin@ticketdrop.ai";
            if (!userRepository.existsByEmailIgnoreCase(email)) {
                User admin = new User();
                admin.setEmail(email);
                admin.setFullName("Platform Super Admin");
                admin.setPasswordHash(passwordEncoder.encode("SuperAdmin@123"));
                admin.setRole(Role.SUPER_ADMIN);
                admin.setStatus(UserStatus.ACTIVE);
                userRepository.save(admin);
                log.info("Seeded default SUPER_ADMIN account: {} / SuperAdmin@123", email);
            }
        };
    }
}

