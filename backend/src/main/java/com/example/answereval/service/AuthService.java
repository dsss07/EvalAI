package com.example.answereval.service;

import com.example.answereval.dto.AuthDtos;
import com.example.answereval.entity.User;
import com.example.answereval.entity.UserRole;
import com.example.answereval.repository.UserRepository;
import com.example.answereval.security.JwtService;
import io.jsonwebtoken.Claims;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthDtos.UserResponse register(AuthDtos.RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName());
        user.setUsn(request.usn());
        user.setSemester(request.semester());
        user.setSection(request.section());
        user.setBranch(request.branch());
        UserRole role = request.role() != null ? request.role() : UserRole.TEACHER;
        user.setRole(role);

        return toResponse(userRepository.save(user));
    }

    public AuthDtos.TokenResponse login(AuthDtos.LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.email().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        return tokensFor(user);
    }

    public AuthDtos.TokenResponse refresh(AuthDtos.RefreshRequest request) {
        try {
            Claims claims = jwtService.parse(request.refreshToken());
            if (!"refresh".equals(claims.get("type"))) {
                throw new IllegalArgumentException("Not a refresh token");
            }

            UUID userId = UUID.fromString(claims.getSubject());
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

            return tokensFor(user);
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }
    }

    private AuthDtos.TokenResponse tokensFor(User user) {
        return new AuthDtos.TokenResponse(
                jwtService.createAccessToken(user.getId(), user.getRole()),
                jwtService.createRefreshToken(user.getId(), user.getRole()),
                "bearer"
        );
    }

    public AuthDtos.UserResponse toResponse(User user) {
        return new AuthDtos.UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getUsn(),
                user.getSemester(),
                user.getSection(),
                user.getBranch(),
                user.getRole(),
                user.getCreatedAt()
        );
    }
}
