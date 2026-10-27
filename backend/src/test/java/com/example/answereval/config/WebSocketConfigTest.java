package com.example.answereval.config;

import com.example.answereval.security.WebSocketAuthInterceptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebSocketConfigTest {

    @Mock
    private WebSocketAuthInterceptor webSocketAuthInterceptor;

    @Mock
    private MessageBrokerRegistry messageBrokerRegistry;

    @Mock
    private StompEndpointRegistry stompEndpointRegistry;

    @Mock
    private StompWebSocketEndpointRegistration endpointRegistration;

    @Mock
    private ChannelRegistration channelRegistration;

    @InjectMocks
    private WebSocketConfig webSocketConfig;

    @Test
    void configureMessageBrokerShouldEnableSimpleBrokerAndPrefixes() {
        webSocketConfig.configureMessageBroker(messageBrokerRegistry);

        verify(messageBrokerRegistry, times(1)).enableSimpleBroker("/topic", "/queue");
        verify(messageBrokerRegistry, times(1)).setApplicationDestinationPrefixes("/app");
        verify(messageBrokerRegistry, times(1)).setUserDestinationPrefix("/user");
    }

    @Test
    void registerStompEndpointsShouldRegisterWsEvalEndpoints() {
        when(stompEndpointRegistry.addEndpoint("/ws-eval")).thenReturn(endpointRegistration);
        when(endpointRegistration.setAllowedOriginPatterns("*")).thenReturn(endpointRegistration);

        webSocketConfig.registerStompEndpoints(stompEndpointRegistry);

        verify(stompEndpointRegistry, times(2)).addEndpoint("/ws-eval");
        verify(endpointRegistration, times(2)).setAllowedOriginPatterns("*");
        verify(endpointRegistration, times(1)).withSockJS();
    }

    @Test
    void configureClientInboundChannelShouldRegisterAuthInterceptor() {
        webSocketConfig.configureClientInboundChannel(channelRegistration);

        verify(channelRegistration, times(1)).interceptors(webSocketAuthInterceptor);
    }
}
