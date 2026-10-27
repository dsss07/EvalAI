package com.example.answereval.service;

import com.example.answereval.dto.QuestionScoreItem;
import com.example.answereval.entity.QuestionSet;
import com.example.answereval.entity.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private org.springframework.beans.factory.ObjectProvider<JavaMailSender> mailSenderProvider;

    @Test
    void sendResultsPublishedEmail_runsInMockModeWhenCredentialsUnset() {
        EmailService emailService = new EmailService(mailSenderProvider);
        ReflectionTestUtils.setField(emailService, "mailHost", "localhost");
        ReflectionTestUtils.setField(emailService, "mailUsername", "");
        ReflectionTestUtils.setField(emailService, "frontendUrl", "http://localhost:5173");

        User student = new User();
        student.setEmail("student@example.com");
        student.setFullName("John Doe");

        QuestionSet set = new QuestionSet();
        set.setTitle("Midterm Assessment");
        set.setSubject("Operating Systems");

        List<QuestionScoreItem> breakdown = List.of(
                new QuestionScoreItem(1, "What is a deadlock?", 8.5, 10.0),
                new QuestionScoreItem(2, "Explain paging.", 9.0, 10.0)
        );

        assertDoesNotThrow(() -> {
            emailService.sendResultsPublishedEmail(student, set, 17.5, 20.0, breakdown);
        });
    }
}
