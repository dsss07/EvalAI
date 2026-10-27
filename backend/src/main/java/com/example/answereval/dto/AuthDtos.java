package com.example.answereval.dto;

import com.example.answereval.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @Email @NotBlank String email,
            @NotBlank String password,
            @NotBlank String fullName,
            String usn,
            Integer semester,
            String section,
            String branch,
            UserRole role
    ) {
    }

    public record LoginRequest(
            @Email @NotBlank String email,
            @NotBlank String password
    ) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record TokenResponse(
            String accessToken,
            String refreshToken,
            String tokenType
    ) {
    }

    public record UserResponse(
            UUID id,
            String email,
            String fullName,
            String usn,
            Integer semester,
            String section,
            String branch,
            UserRole role,
            OffsetDateTime createdAt
    ) {
    }
}
