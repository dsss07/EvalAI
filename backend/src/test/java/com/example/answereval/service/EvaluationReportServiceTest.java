package com.example.answereval.service;

import com.example.answereval.dto.ReportDtos;
import com.example.answereval.entity.*;
import com.example.answereval.repository.EvaluationReportRepository;
import com.example.answereval.repository.QuestionSetRepository;
import com.example.answereval.repository.SubmissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EvaluationReportServiceTest {

    @Mock
    private EvaluationReportRepository reportRepository;

    @Mock
    private QuestionSetRepository questionSetRepository;

    @Mock
    private SubmissionRepository submissionRepository;

    @Mock
    private QuestionSetService questionSetService;

    private EvaluationReportService evaluationReportService;

    private User student;
    private User teacher;
    private QuestionSet questionSet;
    private Submission submission;

    private void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @BeforeEach
    void setUp() {
        evaluationReportService = new EvaluationReportService(
                reportRepository,
                questionSetRepository,
                submissionRepository,
                questionSetService
        );

        student = new User();
        setField(student, "id", UUID.randomUUID());
        student.setEmail("student@test.com");
        student.setRole(UserRole.STUDENT);
        student.setFullName("Test Student");

        teacher = new User();
        setField(teacher, "id", UUID.randomUUID());
        teacher.setEmail("teacher@test.com");
        teacher.setRole(UserRole.TEACHER);
        teacher.setFullName("Prof. Test");

        questionSet = new QuestionSet();
        setField(questionSet, "id", UUID.randomUUID());
        questionSet.setTitle("Midterm Exam");
        questionSet.setSubject("Data Structures");
        questionSet.setTeacher(teacher);

        Question question = new Question();
        setField(question, "id", UUID.randomUUID());
        question.setQuestionSet(questionSet);
        question.setQuestionText("Explain Quicksort");

        submission = new Submission();
        setField(submission, "id", UUID.randomUUID());
        submission.setStudent(student);
        submission.setQuestion(question);
    }

    @Test
    void createReport_success() {
        UUID setId = questionSet.getId();
        ReportDtos.CreateReportRequest request = new ReportDtos.CreateReportRequest(
                setId,
                submission.getId(),
                1,
                "Marks are lower than expected for step 3"
        );

        when(questionSetRepository.findById(setId)).thenReturn(Optional.of(questionSet));
        when(questionSetService.isEligible(questionSet, student)).thenReturn(true);
        when(submissionRepository.findById(submission.getId())).thenReturn(Optional.of(submission));

        when(reportRepository.save(any(EvaluationReport.class))).thenAnswer(invocation -> {
            EvaluationReport report = invocation.getArgument(0);
            setField(report, "id", UUID.randomUUID());
            setField(report, "createdAt", LocalDateTime.now());
            return report;
        });

        ReportDtos.ReportResponse response = evaluationReportService.createReport(request, student);

        assertNotNull(response);
        assertEquals("Midterm Exam", response.setTitle());
        assertEquals(ReportStatus.PENDING, response.status());
        assertEquals("Marks are lower than expected for step 3", response.reason());
        verify(reportRepository, times(1)).save(any(EvaluationReport.class));
    }

    @Test
    void createReport_failsWhenUserNotStudent() {
        ReportDtos.CreateReportRequest request = new ReportDtos.CreateReportRequest(
                questionSet.getId(),
                null,
                null,
                "Reason"
        );

        assertThrows(ResponseStatusException.class, () -> evaluationReportService.createReport(request, teacher));
    }

    @Test
    void getTeacherReports_filtersByStatus() {
        EvaluationReport report = new EvaluationReport(student, questionSet, submission, 1, "Discrepancy");
        setField(report, "id", UUID.randomUUID());
        setField(report, "createdAt", LocalDateTime.now());

        when(reportRepository.findByTeacherIdAndStatus(teacher.getId(), ReportStatus.PENDING))
                .thenReturn(List.of(report));

        List<ReportDtos.ReportResponse> responses = evaluationReportService.getTeacherReports(teacher, ReportStatus.PENDING);

        assertEquals(1, responses.size());
        assertEquals(report.getId(), responses.get(0).id());
        assertEquals(ReportStatus.PENDING, responses.get(0).status());
    }

    @Test
    void resolveReport_success() {
        EvaluationReport report = new EvaluationReport(student, questionSet, submission, 1, "Discrepancy");
        setField(report, "id", UUID.randomUUID());
        setField(report, "createdAt", LocalDateTime.now());

        when(reportRepository.findById(report.getId())).thenReturn(Optional.of(report));
        when(reportRepository.save(any(EvaluationReport.class))).thenAnswer(i -> i.getArgument(0));

        ReportDtos.ResolveReportRequest resolveRequest = new ReportDtos.ResolveReportRequest(
                ReportStatus.RESOLVED,
                "Marks updated after reviewing step 3."
        );

        ReportDtos.ReportResponse response = evaluationReportService.resolveReport(report.getId(), resolveRequest, teacher);

        assertEquals(ReportStatus.RESOLVED, response.status());
        assertEquals("Marks updated after reviewing step 3.", response.resolutionRemarks());
        assertNotNull(response.resolvedAt());
    }

    @Test
    void autoResolveForSubmission_resolvesPendingReports() {
        EvaluationReport report = new EvaluationReport(student, questionSet, submission, 1, "Discrepancy");
        setField(report, "id", UUID.randomUUID());
        setField(report, "createdAt", LocalDateTime.now());

        when(reportRepository.findBySubmissionIdAndStatus(submission.getId(), ReportStatus.PENDING))
                .thenReturn(List.of(report));

        evaluationReportService.autoResolveForSubmission(submission);

        assertEquals(ReportStatus.RESOLVED, report.getStatus());
        assertNotNull(report.getResolvedAt());
        assertTrue(report.getResolutionRemarks().contains("Auto-resolved"));
        verify(reportRepository, times(1)).saveAll(any());
    }
}
