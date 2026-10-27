package com.example.answereval.service;

import com.example.answereval.dto.QuestionSetDtos;
import com.example.answereval.entity.*;
import com.example.answereval.repository.MCQQuestionRepository;
import com.example.answereval.repository.QuestionRepository;
import com.example.answereval.repository.QuestionSetRepository;
import com.example.answereval.repository.SubmissionRepository;
import com.example.answereval.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuestionSetCreateTest {

    @Mock
    private QuestionSetRepository questionSetRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private MCQQuestionRepository mcqQuestionRepository;

    @Mock
    private SubmissionRepository submissionRepository;

    @Mock
    private UserRepository userRepository;

    private QuestionSetService questionSetService;
    private User teacher;

    @BeforeEach
    void setUp() {
        questionSetService = new QuestionSetService(
                questionSetRepository,
                questionRepository,
                mcqQuestionRepository,
                submissionRepository,
                userRepository
        );

        teacher = new User();
        teacher.setRole(UserRole.TEACHER);
        try {
            var idField = User.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(teacher, UUID.randomUUID());
        } catch (Exception ex) {
            fail(ex);
        }
    }

    @Test
    void shouldCreateQuestionSetWithSchedulingWindowAndGracePeriod() {
        OffsetDateTime start = OffsetDateTime.now().plusHours(1);
        OffsetDateTime end = start.plusHours(2);

        QuestionSetDtos.CreateRequest request = new QuestionSetDtos.CreateRequest(
                "Algorithms Midterm",
                "Graph algorithms",
                5,
                "A",
                "CSE",
                "DAA",
                GradingMode.MID,
                TestType.DESCRIPTIVE,
                List.of(),
                start,
                end,
                null,
                15
        );

        when(questionSetRepository.save(any(QuestionSet.class)))
                .thenAnswer(invocation -> {
                    QuestionSet qs = invocation.getArgument(0);
                    java.lang.reflect.Field idField = QuestionSet.class.getDeclaredField("id");
                    idField.setAccessible(true);
                    idField.set(qs, UUID.randomUUID());
                    return qs;
                });

        QuestionSetDtos.Response response = questionSetService.create(request, teacher);

        assertNotNull(response);
        assertEquals("Algorithms Midterm", response.title());
        assertEquals(start, response.startTime());
        assertEquals(end, response.endTime());
        assertEquals(120, response.durationMinutes());
        assertEquals(15, response.gracePeriodMinutes());
    }

    @Test
    void shouldThrowBadRequestWhenEndTimeBeforeStartTimeOnCreate() {
        OffsetDateTime start = OffsetDateTime.now().plusHours(2);
        OffsetDateTime end = OffsetDateTime.now().plusHours(1);

        QuestionSetDtos.CreateRequest request = new QuestionSetDtos.CreateRequest(
                "Invalid Schedule Exam",
                "Description",
                5,
                "A",
                "CSE",
                "DAA",
                GradingMode.MID,
                TestType.DESCRIPTIVE,
                List.of(),
                start,
                end,
                null,
                5
        );

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> questionSetService.create(request, teacher)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("End time must be after start time"));
    }

    @Test
    void shouldPersistRubricWhenAddingQuestion() {
        UUID setId = UUID.randomUUID();
        QuestionSet qs = new QuestionSet();
        qs.setTeacher(teacher);
        when(questionSetRepository.findById(setId)).thenReturn(java.util.Optional.of(qs));

        QuestionSetDtos.CreateQuestionRequest request = new QuestionSetDtos.CreateQuestionRequest(
                "Explain QuickSort",
                "Divide and conquer algorithm...",
                10,
                1,
                "Definition: 2M, Algorithm: 5M, Complexity Analysis: 3M"
        );

        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> {
            Question q = invocation.getArgument(0);
            java.lang.reflect.Field idField = Question.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(q, UUID.randomUUID());
            return q;
        });

        QuestionSetDtos.QuestionResponse response = questionSetService.addQuestion(setId, request, teacher);

        assertNotNull(response);
        assertEquals("Explain QuickSort", response.questionText());
        assertEquals("Definition: 2M, Algorithm: 5M, Complexity Analysis: 3M", response.rubric());
    }
}
