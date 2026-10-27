package com.example.answereval.listener;

import com.example.answereval.config.RabbitMQConfig;
import com.example.answereval.dto.EvaluationMessage;
import com.example.answereval.dto.ScriptOcrMessage;
import com.example.answereval.dto.SubmissionProgressEvent;
import com.example.answereval.entity.Question;
import com.example.answereval.entity.QuestionSet;
import com.example.answereval.entity.Submission;
import com.example.answereval.entity.User;
import com.example.answereval.repository.QuestionRepository;
import com.example.answereval.repository.SubmissionRepository;
import com.example.answereval.repository.UserRepository;
import com.example.answereval.service.EvaluationService;
import com.example.answereval.service.FileStorageService;
import com.example.answereval.service.GeminiService;
import com.example.answereval.service.ProgressBroadcasterService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubmissionListenersTest {

    @Mock
    private EvaluationService evaluationService;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private GeminiService geminiService;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private SubmissionRepository submissionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @Mock
    private ProgressBroadcasterService progressBroadcasterService;

    @Test
    void scoringListenerShouldBroadcastProgressAndCallEvaluationService() {
        SubmissionScoringListener listener = new SubmissionScoringListener(
                evaluationService,
                submissionRepository,
                progressBroadcasterService
        );

        UUID submissionId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        UUID setId = UUID.randomUUID();
        EvaluationMessage message = new EvaluationMessage(submissionId, questionId, "Sample answer");

        User student = new User();
        student.setEmail("student@test.edu");

        QuestionSet questionSet = new QuestionSet();
        try {
            var setIdField = QuestionSet.class.getDeclaredField("id");
            setIdField.setAccessible(true);
            setIdField.set(questionSet, setId);
        } catch (Exception ex) {
            fail(ex);
        }

        Question question = new Question();
        question.setQuestionOrder(2);
        question.setQuestionSet(questionSet);

        Submission submission = new Submission();
        submission.setStudent(student);
        submission.setQuestion(question);

        when(submissionRepository.findById(submissionId)).thenReturn(Optional.of(submission));

        listener.onEvaluationMessage(message);

        verify(evaluationService, times(1)).evaluate(submissionId);

        ArgumentCaptor<SubmissionProgressEvent> eventCaptor = ArgumentCaptor.forClass(SubmissionProgressEvent.class);
        verify(progressBroadcasterService, times(2)).broadcast(
                eq("student@test.edu"),
                eq(setId),
                eventCaptor.capture()
        );

        List<SubmissionProgressEvent> events = eventCaptor.getAllValues();
        assertEquals("SCORING_IN_PROGRESS", events.get(0).stage());
        assertEquals(75, events.get(0).progressPercentage());
        assertEquals("GRADED", events.get(1).stage());
        assertEquals(100, events.get(1).progressPercentage());
    }

    @Test
    void scoringListenerShouldBroadcastFailedAndPropagateExceptionForRetry() {
        SubmissionScoringListener listener = new SubmissionScoringListener(
                evaluationService,
                submissionRepository,
                progressBroadcasterService
        );

        UUID submissionId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        EvaluationMessage message = new EvaluationMessage(submissionId, questionId, "Sample answer");

        when(submissionRepository.findById(submissionId)).thenReturn(Optional.empty());

        doThrow(new RuntimeException("Simulated evaluation failure"))
                .when(evaluationService).evaluate(submissionId);

        assertThrows(RuntimeException.class, () -> listener.onEvaluationMessage(message));

        ArgumentCaptor<SubmissionProgressEvent> eventCaptor = ArgumentCaptor.forClass(SubmissionProgressEvent.class);
        verify(progressBroadcasterService, atLeastOnce()).broadcast(
                isNull(),
                isNull(),
                eventCaptor.capture()
        );

        List<SubmissionProgressEvent> events = eventCaptor.getAllValues();
        assertTrue(events.stream().anyMatch(e -> "FAILED".equals(e.stage())));
    }

    @Test
    void ocrListenerShouldProcessScriptAndBroadcastProgressEvents() throws IOException {
        SubmissionOcrListener listener = new SubmissionOcrListener(
                fileStorageService,
                geminiService,
                questionRepository,
                submissionRepository,
                userRepository,
                rabbitTemplate,
                progressBroadcasterService
        );

        UUID studentId = UUID.randomUUID();
        UUID questionSetId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        List<String> fileKeys = List.of("page1.png");

        User student = new User();
        student.setEmail("student@test.edu");
        when(userRepository.findById(studentId)).thenReturn(Optional.of(student));

        Question question = new Question();
        question.setQuestionText("Explain polymorphism");
        question.setQuestionOrder(1);
        try {
            var idField = Question.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(question, questionId);
        } catch (Exception ex) {
            fail(ex);
        }

        when(questionRepository.findByQuestionSetIdOrderByQuestionOrderAsc(questionSetId))
                .thenReturn(List.of(question));
        when(fileStorageService.loadBytes("page1.png")).thenReturn(new byte[]{1, 2, 3});
        when(fileStorageService.detectContentType("page1.png")).thenReturn("image/png");

        Map<String, Map<String, Object>> parsed = Map.of(
                questionId.toString(), Map.of(
                        "attempted", true,
                        "text", "Polymorphism means many forms."
                )
        );
        when(geminiService.parseFullScript(anyList(), anyList())).thenReturn(parsed);

        Submission existingSubmission = new Submission();
        existingSubmission.setGradingStatus("QUEUED");
        when(submissionRepository.findByStudentIdAndQuestionId(studentId, questionId))
                .thenReturn(Optional.of(existingSubmission));
        when(submissionRepository.save(any(Submission.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ScriptOcrMessage message = new ScriptOcrMessage(studentId, questionSetId, fileKeys, OffsetDateTime.now());

        listener.onScriptOcrMessage(message);

        assertEquals("Polymorphism means many forms.", existingSubmission.getAnswerText());
        assertEquals("SCORING_QUEUED", existingSubmission.getGradingStatus());
        assertFalse(existingSubmission.isNeedsReview());

        ArgumentCaptor<EvaluationMessage> captor = ArgumentCaptor.forClass(EvaluationMessage.class);
        verify(rabbitTemplate, times(1)).convertAndSend(
                eq(RabbitMQConfig.EVAL_EXCHANGE),
                eq(RabbitMQConfig.SUBMISSION_SCORING_KEY),
                captor.capture()
        );

        ArgumentCaptor<SubmissionProgressEvent> eventCaptor = ArgumentCaptor.forClass(SubmissionProgressEvent.class);
        verify(progressBroadcasterService, times(2)).broadcast(
                eq("student@test.edu"),
                eq(questionSetId),
                eventCaptor.capture()
        );

        List<SubmissionProgressEvent> events = eventCaptor.getAllValues();
        assertEquals("OCR_IN_PROGRESS", events.get(0).stage());
        assertEquals(30, events.get(0).progressPercentage());
        assertEquals("OCR_COMPLETED", events.get(1).stage());
        assertEquals(60, events.get(1).progressPercentage());
    }

    @Test
    void ocrListenerShouldBroadcastFailedOnException() throws IOException {
        SubmissionOcrListener listener = new SubmissionOcrListener(
                fileStorageService,
                geminiService,
                questionRepository,
                submissionRepository,
                userRepository,
                rabbitTemplate,
                progressBroadcasterService
        );

        UUID studentId = UUID.randomUUID();
        UUID questionSetId = UUID.randomUUID();
        List<String> fileKeys = List.of("corrupt.png");

        when(userRepository.findById(studentId)).thenReturn(Optional.of(new User()));
        when(questionRepository.findByQuestionSetIdOrderByQuestionOrderAsc(questionSetId))
                .thenReturn(List.of(new Question()));
        when(fileStorageService.loadBytes("corrupt.png")).thenThrow(new IOException("Disk read failed"));

        ScriptOcrMessage message = new ScriptOcrMessage(studentId, questionSetId, fileKeys, OffsetDateTime.now());

        assertThrows(IOException.class, () -> listener.onScriptOcrMessage(message));

        ArgumentCaptor<SubmissionProgressEvent> eventCaptor = ArgumentCaptor.forClass(SubmissionProgressEvent.class);
        verify(progressBroadcasterService, atLeastOnce()).broadcast(
                any(),
                eq(questionSetId),
                eventCaptor.capture()
        );

        assertTrue(eventCaptor.getAllValues().stream().anyMatch(e -> "FAILED".equals(e.stage())));
    }
}
