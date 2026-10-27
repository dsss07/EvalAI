package com.example.answereval.service;

import com.example.answereval.dto.SubmissionDtos;
import com.example.answereval.entity.*;
import com.example.answereval.exception.DuplicateSubmissionException;
import com.example.answereval.exception.ExamDeadlineExceededException;
import com.example.answereval.exception.ExamNotStartedException;
import com.example.answereval.repository.GradeRepository;
import com.example.answereval.repository.QuestionRepository;
import com.example.answereval.repository.SubmissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubmissionTimeGatingAndDuplicateTest {

    @Mock
    private SubmissionRepository submissionRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private GradeRepository gradeRepository;

    @Mock
    private GeminiService geminiService;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private EvaluationService evaluationService;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @Mock
    private ProgressBroadcasterService progressBroadcasterService;

    private SubmissionService submissionService;

    private User student;
    private QuestionSet questionSet;
    private Question question;

    @BeforeEach
    void setUp() {
        submissionService = new SubmissionService(
                submissionRepository,
                questionRepository,
                gradeRepository,
                geminiService,
                fileStorageService,
                evaluationService,
                rabbitTemplate,
                progressBroadcasterService
        );

        student = new User();
        student.setRole(UserRole.STUDENT);
        student.setFullName("John Doe");
        student.setBranch("CSE");
        student.setSemester(6);
        student.setSection("A");
        try {
            var idField = User.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(student, UUID.randomUUID());
        } catch (Exception ex) {
            fail(ex);
        }

        questionSet = new QuestionSet();
        questionSet.setTitle("Operating Systems Midterm");
        questionSet.setBranch("CSE");
        questionSet.setSemester(6);
        questionSet.setSection("A");
        questionSet.setGracePeriodMinutes(5);

        question = new Question();
        question.setQuestionText("Explain deadlock conditions");
        question.setMaxMarks(10);
        question.setQuestionSet(questionSet);
        try {
            var qIdField = Question.class.getDeclaredField("id");
            qIdField.setAccessible(true);
            qIdField.set(question, UUID.randomUUID());

            var setIdField = QuestionSet.class.getDeclaredField("id");
            setIdField.setAccessible(true);
            setIdField.set(questionSet, UUID.randomUUID());
        } catch (Exception ex) {
            fail(ex);
        }
    }

    @Test
    void shouldRejectSubmissionWhenExamNotStarted() {
        questionSet.setStartTime(OffsetDateTime.now().plusHours(2));
        questionSet.setEndTime(OffsetDateTime.now().plusHours(4));

        when(questionRepository.findById(question.getId())).thenReturn(Optional.of(question));

        assertThrows(ExamNotStartedException.class, () ->
                submissionService.submitText(question.getId(), "Deadlock requires mutual exclusion", student)
        );
    }

    @Test
    void shouldAcceptSubmissionWithinActiveWindow() {
        questionSet.setStartTime(OffsetDateTime.now().minusHours(1));
        questionSet.setEndTime(OffsetDateTime.now().plusHours(1));

        when(questionRepository.findById(question.getId())).thenReturn(Optional.of(question));
        when(submissionRepository.existsByStudentIdAndQuestionId(student.getId(), question.getId())).thenReturn(false);
        when(submissionRepository.saveAndFlush(any(Submission.class))).thenAnswer(i -> {
            Submission s = i.getArgument(0);
            return s;
        });

        SubmissionDtos.Response response = submissionService.submitText(
                question.getId(), "Deadlock requires mutual exclusion", student
        );

        assertNotNull(response);
        assertEquals("PENDING", response.gradingStatus());
    }

    @Test
    void shouldAcceptSubmissionDuringGracePeriod() {
        // Exam ended 3 minutes ago, grace period is 5 minutes -> still valid!
        questionSet.setStartTime(OffsetDateTime.now().minusHours(2));
        questionSet.setEndTime(OffsetDateTime.now().minusMinutes(3));
        questionSet.setGracePeriodMinutes(5);

        when(questionRepository.findById(question.getId())).thenReturn(Optional.of(question));
        when(submissionRepository.existsByStudentIdAndQuestionId(student.getId(), question.getId())).thenReturn(false);
        when(submissionRepository.saveAndFlush(any(Submission.class))).thenAnswer(i -> i.getArgument(0));

        SubmissionDtos.Response response = submissionService.submitText(
                question.getId(), "Answer during grace period", student
        );

        assertNotNull(response);
    }

    @Test
    void shouldRejectSubmissionWhenDeadlineAndGracePeriodExceeded() {
        // Exam ended 10 minutes ago, grace period is 5 minutes -> deadline passed!
        questionSet.setStartTime(OffsetDateTime.now().minusHours(2));
        questionSet.setEndTime(OffsetDateTime.now().minusMinutes(10));
        questionSet.setGracePeriodMinutes(5);

        when(questionRepository.findById(question.getId())).thenReturn(Optional.of(question));

        assertThrows(ExamDeadlineExceededException.class, () ->
                submissionService.submitText(question.getId(), "Too late answer", student)
        );
    }

    @Test
    void shouldRejectDuplicateFullScriptSubmission() {
        when(questionRepository.findByQuestionSetIdOrderByQuestionOrderAsc(questionSet.getId()))
                .thenReturn(List.of(question));
        when(submissionRepository.existsByStudentIdAndQuestionQuestionSetId(student.getId(), questionSet.getId()))
                .thenReturn(true);

        MockMultipartFile file = new MockMultipartFile("files", "script.pdf", "application/pdf", new byte[]{1, 2});

        assertThrows(DuplicateSubmissionException.class, () ->
                submissionService.submitFullScript(questionSet.getId(), List.of(file), student)
        );
    }

    @Test
    void shouldCatchDataIntegrityViolationAndThrowDuplicateSubmissionException() throws IOException {
        questionSet.setStartTime(OffsetDateTime.now().minusHours(1));
        questionSet.setEndTime(OffsetDateTime.now().plusHours(1));

        when(questionRepository.findByQuestionSetIdOrderByQuestionOrderAsc(questionSet.getId()))
                .thenReturn(List.of(question));
        when(submissionRepository.existsByStudentIdAndQuestionQuestionSetId(student.getId(), questionSet.getId()))
                .thenReturn(false);
        when(fileStorageService.store(any())).thenReturn(
                new FileStorageService.StoredFile("stored.png", null, "image/png")
        );
        when(submissionRepository.saveAndFlush(any(Submission.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate key value violates unique constraint"));

        MockMultipartFile file = new MockMultipartFile("files", "script.png", "image/png", new byte[]{1, 2});

        assertThrows(DuplicateSubmissionException.class, () ->
                submissionService.submitFullScript(questionSet.getId(), List.of(file), student)
        );
    }
}
