package com.example.answereval.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EVAL_EXCHANGE = "eval.exchange";
    public static final String EVAL_DLX = "eval.dlx";
    public static final String SUBMISSION_DLQ = "submission.dlq";

    public static final String SUBMISSION_OCR_QUEUE = "submission.ocr.queue";
    public static final String SUBMISSION_OCR_KEY = "submission.ocr.key";

    public static final String SUBMISSION_SCORING_QUEUE = "submission.scoring.queue";
    public static final String SUBMISSION_SCORING_KEY = "submission.scoring.key";

    @Bean
    public DirectExchange evalExchange() {
        return new DirectExchange(EVAL_EXCHANGE, true, false);
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(EVAL_DLX, true, false);
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(SUBMISSION_DLQ).build();
    }

    @Bean
    public Binding deadLetterBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with(SUBMISSION_DLQ);
    }

    @Bean
    public Queue submissionOcrQueue() {
        return QueueBuilder.durable(SUBMISSION_OCR_QUEUE)
                .withArgument("x-dead-letter-exchange", EVAL_DLX)
                .withArgument("x-dead-letter-routing-key", SUBMISSION_DLQ)
                .build();
    }

    @Bean
    public Binding submissionOcrBinding(Queue submissionOcrQueue, DirectExchange evalExchange) {
        return BindingBuilder.bind(submissionOcrQueue).to(evalExchange).with(SUBMISSION_OCR_KEY);
    }

    @Bean
    public Queue submissionScoringQueue() {
        return QueueBuilder.durable(SUBMISSION_SCORING_QUEUE)
                .withArgument("x-dead-letter-exchange", EVAL_DLX)
                .withArgument("x-dead-letter-routing-key", SUBMISSION_DLQ)
                .build();
    }

    @Bean
    public Binding submissionScoringBinding(Queue submissionScoringQueue, DirectExchange evalExchange) {
        return BindingBuilder.bind(submissionScoringQueue).to(evalExchange).with(SUBMISSION_SCORING_KEY);
    }

    @Bean
    public MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        ObjectMapper mapper = (objectMapper != null ? objectMapper.copy() : new ObjectMapper());
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter(mapper, "*");
        converter.setAlwaysConvertToInferredType(true);
        return converter;
    }

    public MessageConverter jsonMessageConverter() {
        return jsonMessageConverter(new ObjectMapper());
    }
}
