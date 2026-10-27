package com.example.answereval.security;

import com.example.answereval.entity.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private final SecretKey key;
    private final long accessMinutes;
    private final long refreshDays;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-expiration-minutes}") long accessMinutes,
            @Value("${app.jwt.refresh-expiration-days}") long refreshDays
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessMinutes = accessMinutes;
        this.refreshDays = refreshDays;
    }

    public String createAccessToken(UUID userId, UserRole role) {
        return createToken(userId, role, "access", Instant.now().plus(accessMinutes, ChronoUnit.MINUTES));
    }

    public String createRefreshToken(UUID userId, UserRole role) {
        return createToken(userId, role, "refresh", Instant.now().plus(refreshDays, ChronoUnit.DAYS));
    }

    private String createToken(UUID userId, UserRole role, String type, Instant expiry) {
        return Jwts.builder()
                .subject(userId.toString())
                .claim("role", role.name())
                .claim("type", type)
                .issuedAt(new Date())
                .expiration(Date.from(expiry))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
