package com.example.answereval.service;

import com.example.answereval.dto.AssessmentState;
import com.example.answereval.dto.QuestionSetDtos;
import com.example.answereval.dto.StudentAssessmentStatusDto;
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

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentAssessmentStatusTest {

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

    private User student;
    private QuestionSet questionSet;
    private UUID setId;

    @BeforeEach
    void setUp() {
        questionSetService = new QuestionSetService(
                questionSetRepository,
                questionRepository,
                mcqQuestionRepository,
                submissionRepository,
                userRepository
        );

        student = new User();
        student.setRole(UserRole.STUDENT);
        student.setFullName("Alice Bob");
        student.setBranch("ECE");
        student.setSemester(4);
        student.setSection("B");
        try {
            var idField = User.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(student, UUID.randomUUID());
        } catch (Exception ex) {
            fail(ex);
        }

        setId = UUID.randomUUID();
        questionSet = new QuestionSet();
        questionSet.setTitle("Signals and Systems Exam");
        questionSet.setBranch("ECE");
        questionSet.setSemester(4);
        questionSet.setSection("B");
        questionSet.setGracePeriodMinutes(5);
        try {
            var setIdField = QuestionSet.class.getDeclaredField("id");
            setIdField.setAccessible(true);
            setIdField.set(questionSet, setId);
        } catch (Exception ex) {
            fail(ex);
        }

        when(questionSetRepository.findById(setId)).thenReturn(Optional.of(questionSet));
    }

    @Test
    void shouldResolveUpcomingStateWhenBeforeStartTime() {
        questionSet.setStartTime(OffsetDateTime.now().plusHours(1));
        questionSet.setEndTime(OffsetDateTime.now().plusHours(3));

        when(submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(setId))
                .thenReturn(List.of());

        StudentAssessmentStatusDto status = questionSetService.getStudentAssessmentStatus(setId, student);

        assertEquals(AssessmentState.UPCOMING, status.state());
        assertFalse(status.submitted());
        assertNull(status.submittedAt());
        assertNull(status.gradingStatus());
        assertNotNull(status.serverTime());
    }

    @Test
    void shouldResolveOpenStateWhenWithinActiveWindow() {
        questionSet.setStartTime(OffsetDateTime.now().minusMinutes(30));
        questionSet.setEndTime(OffsetDateTime.now().plusMinutes(60));

        when(submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(setId))
                .thenReturn(List.of());

        StudentAssessmentStatusDto status = questionSetService.getStudentAssessmentStatus(setId, student);

        assertEquals(AssessmentState.OPEN, status.state());
        assertFalse(status.submitted());
    }

    @Test
    void shouldResolveOpenStateDuringGracePeriod() {
        // Ended 2 mins ago, 5 min grace period
        questionSet.setStartTime(OffsetDateTime.now().minusHours(1));
        questionSet.setEndTime(OffsetDateTime.now().minusMinutes(2));
        questionSet.setGracePeriodMinutes(5);

        when(submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(setId))
                .thenReturn(List.of());

        StudentAssessmentStatusDto status = questionSetService.getStudentAssessmentStatus(setId, student);

        assertEquals(AssessmentState.OPEN, status.state());
        assertFalse(status.submitted());
    }

    @Test
    void shouldResolveClosedStateWhenDeadlineExceeded() {
        // Ended 10 mins ago, 5 min grace period -> expired
        questionSet.setStartTime(OffsetDateTime.now().minusHours(2));
        questionSet.setEndTime(OffsetDateTime.now().minusMinutes(10));
        questionSet.setGracePeriodMinutes(5);

        when(submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(setId))
                .thenReturn(List.of());

        StudentAssessmentStatusDto status = questionSetService.getStudentAssessmentStatus(setId, student);

        assertEquals(AssessmentState.CLOSED, status.state());
        assertFalse(status.submitted());
    }

    @Test
    void shouldResolveSubmittedStateWhenSubmissionsExist() {
        questionSet.setStartTime(OffsetDateTime.now().minusHours(1));
        questionSet.setEndTime(OffsetDateTime.now().plusHours(1));

        Submission sub = new Submission();
        sub.setStudent(student);
        sub.setGradingStatus("SCORING_QUEUED");
        sub.setImageUrl("/uploads/page1.jpg");

        when(submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(setId))
                .thenReturn(List.of(sub));

        StudentAssessmentStatusDto status = questionSetService.getStudentAssessmentStatus(setId, student);

        assertEquals(AssessmentState.SUBMITTED, status.state());
        assertTrue(status.submitted());
        assertEquals("SCORING_QUEUED", status.gradingStatus());
        assertEquals(List.of("/uploads/page1.jpg"), status.fileUrls());
    }
}
