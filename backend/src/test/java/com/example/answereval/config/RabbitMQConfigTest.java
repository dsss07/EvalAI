package com.example.answereval.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.MessageConverter;

import static org.junit.jupiter.api.Assertions.*;

class RabbitMQConfigTest {

    private final RabbitMQConfig config = new RabbitMQConfig();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void shouldCreateExchangesAndQueuesCorrectly() {
        DirectExchange evalExchange = config.evalExchange();
        assertEquals("eval.exchange", evalExchange.getName());

        DirectExchange dlx = config.deadLetterExchange();
        assertEquals("eval.dlx", dlx.getName());

        Queue dlq = config.deadLetterQueue();
        assertEquals("submission.dlq", dlq.getName());

        Queue ocrQueue = config.submissionOcrQueue();
        assertEquals("submission.ocr.queue", ocrQueue.getName());
        assertEquals("eval.dlx", ocrQueue.getArguments().get("x-dead-letter-exchange"));
        assertEquals("submission.dlq", ocrQueue.getArguments().get("x-dead-letter-routing-key"));

        Queue scoringQueue = config.submissionScoringQueue();
        assertEquals("submission.scoring.queue", scoringQueue.getName());
        assertEquals("eval.dlx", scoringQueue.getArguments().get("x-dead-letter-exchange"));
        assertEquals("submission.dlq", scoringQueue.getArguments().get("x-dead-letter-routing-key"));
    }

    @Test
    void shouldCreateBindingsCorrectly() {
        DirectExchange evalExchange = config.evalExchange();
        DirectExchange dlx = config.deadLetterExchange();
        Queue dlq = config.deadLetterQueue();
        Queue ocrQueue = config.submissionOcrQueue();
        Queue scoringQueue = config.submissionScoringQueue();

        Binding dlqBinding = config.deadLetterBinding(dlq, dlx);
        assertEquals("submission.dlq", dlqBinding.getRoutingKey());

        Binding ocrBinding = config.submissionOcrBinding(ocrQueue, evalExchange);
        assertEquals("submission.ocr.key", ocrBinding.getRoutingKey());

        Binding scoringBinding = config.submissionScoringBinding(scoringQueue, evalExchange);
        assertEquals("submission.scoring.key", scoringBinding.getRoutingKey());
    }

    @Test
    void shouldProvideJsonMessageConverter() {
        MessageConverter converter = config.jsonMessageConverter(objectMapper);
        assertNotNull(converter);
    }
}
