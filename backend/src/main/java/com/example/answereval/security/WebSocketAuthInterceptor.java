package com.example.answereval.security;

import com.example.answereval.entity.User;
import com.example.answereval.repository.UserRepository;
import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(WebSocketAuthInterceptor.class);

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public WebSocketAuthInterceptor(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader == null) {
                authHeader = accessor.getFirstNativeHeader("authorization");
            }

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                try {
                    Claims claims = jwtService.parse(token);
                    if ("access".equals(claims.get("type"))) {
                        UUID userId = UUID.fromString(claims.getSubject());
                        User user = userRepository.findById(userId).orElse(null);
                        if (user != null) {
                            UserPrincipal principal = new UserPrincipal(user);
                            UsernamePasswordAuthenticationToken authentication =
                                    new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                            SecurityContextHolder.getContext().setAuthentication(authentication);

                            if (accessor.isMutable()) {
                                accessor.setUser(authentication);
                            } else {
                                StompHeaderAccessor mutableAccessor = StompHeaderAccessor.create(accessor.getCommand());
                                mutableAccessor.copyHeaders(message.getHeaders());
                                mutableAccessor.setUser(authentication);
                                message = MessageBuilder.createMessage(message.getPayload(), mutableAccessor.getMessageHeaders());
                            }
                            log.info("WebSocket STOMP connected user: email={}, userId={}", user.getEmail(), user.getId());
                        }
                    }
                } catch (Exception ex) {
                    log.warn("WebSocket STOMP authentication failed: {}", ex.getMessage());
                }
            }
        }
        return message;
    }
}
