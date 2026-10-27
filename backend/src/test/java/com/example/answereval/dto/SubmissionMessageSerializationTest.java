package com.example.answereval.dto;

import com.example.answereval.config.RabbitMQConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.support.converter.MessageConverter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class SubmissionMessageSerializationTest {

    private final ObjectMapper objectMapper = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .build();
    private final RabbitMQConfig rabbitMQConfig = new RabbitMQConfig();
    private final MessageConverter converter = rabbitMQConfig.jsonMessageConverter(objectMapper);

    @Test
    void shouldSerializeAndDeserializeScriptOcrMessage() {
        UUID studentId = UUID.randomUUID();
        UUID questionSetId = UUID.randomUUID();
        List<String> fileKeys = List.of("upload-page1.png", "upload-page2.png");
        OffsetDateTime now = OffsetDateTime.now();

        ScriptOcrMessage original = new ScriptOcrMessage(studentId, questionSetId, fileKeys, now);

        Message message = converter.toMessage(original, new MessageProperties());
        assertNotNull(message);

        Object converted = converter.fromMessage(message);
        assertInstanceOf(ScriptOcrMessage.class, converted);

        ScriptOcrMessage deserialized = (ScriptOcrMessage) converted;
        assertEquals(studentId, deserialized.studentId());
        assertEquals(questionSetId, deserialized.questionSetId());
        assertEquals(fileKeys, deserialized.filePaths());
    }

    @Test
    void shouldSerializeAndDeserializeEvaluationMessage() {
        UUID submissionId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        String answerText = "Object Oriented Programming involves encapsulation, inheritance, and polymorphism.";

        EvaluationMessage original = new EvaluationMessage(submissionId, questionId, answerText);

        Message message = converter.toMessage(original, new MessageProperties());
        assertNotNull(message);

        Object converted = converter.fromMessage(message);
        assertInstanceOf(EvaluationMessage.class, converted);

        EvaluationMessage deserialized = (EvaluationMessage) converted;
        assertEquals(submissionId, deserialized.submissionId());
        assertEquals(questionId, deserialized.questionId());
        assertEquals(answerText, deserialized.extractedAnswerText());
    }
}
