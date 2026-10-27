package com.example.answereval.service;

import com.example.answereval.dto.ReportDtos;
import com.example.answereval.entity.*;
import com.example.answereval.repository.EvaluationReportRepository;
import com.example.answereval.repository.QuestionSetRepository;
import com.example.answereval.repository.SubmissionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class EvaluationReportService {

    private final EvaluationReportRepository reportRepository;
    private final QuestionSetRepository questionSetRepository;
    private final SubmissionRepository submissionRepository;
    private final QuestionSetService questionSetService;

    public EvaluationReportService(
            EvaluationReportRepository reportRepository,
            QuestionSetRepository questionSetRepository,
            SubmissionRepository submissionRepository,
            QuestionSetService questionSetService
    ) {
        this.reportRepository = reportRepository;
        this.questionSetRepository = questionSetRepository;
        this.submissionRepository = submissionRepository;
        this.questionSetService = questionSetService;
    }

    @Transactional
    public ReportDtos.ReportResponse createReport(ReportDtos.CreateReportRequest request, User student) {
        if (student.getRole() != UserRole.STUDENT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only students can submit discrepancy reports");
        }

        QuestionSet set = questionSetRepository.findById(request.setId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question set not found"));

        if (!questionSetService.isEligible(set, student)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student is not enrolled in this assessment");
        }

        Submission submission = null;
        if (request.submissionId() != null) {
            submission = submissionRepository.findById(request.submissionId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submission not found"));
            if (!submission.getStudent().getId().equals(student.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this submission");
            }
        }

        EvaluationReport report = new EvaluationReport(
                student,
                set,
                submission,
                request.questionNumber(),
                request.reason().trim()
        );

        EvaluationReport saved = reportRepository.save(report);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ReportDtos.ReportResponse> getTeacherReports(User teacher, ReportStatus status) {
        if (teacher.getRole() != UserRole.TEACHER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Teacher privileges required");
        }

        List<EvaluationReport> list = status != null
                ? reportRepository.findByTeacherIdAndStatus(teacher.getId(), status)
                : reportRepository.findByTeacherId(teacher.getId());

        return list.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ReportDtos.PendingCountResponse getTeacherPendingCount(User teacher) {
        if (teacher.getRole() != UserRole.TEACHER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Teacher privileges required");
        }
        long count = reportRepository.countByTeacherIdAndStatus(teacher.getId(), ReportStatus.PENDING);
        return new ReportDtos.PendingCountResponse(count);
    }

    @Transactional
    public ReportDtos.ReportResponse resolveReport(UUID reportId, ReportDtos.ResolveReportRequest request, User teacher) {
        if (teacher.getRole() != UserRole.TEACHER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Teacher privileges required");
        }

        EvaluationReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluation report not found"));

        if (!report.getQuestionSet().getTeacher().getId().equals(teacher.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own the assessment for this report");
        }

        ReportStatus newStatus = request != null && request.status() != null ? request.status() : ReportStatus.RESOLVED;
        report.setStatus(newStatus);
        report.setResolvedAt(LocalDateTime.now());
        if (request != null && request.resolutionRemarks() != null && !request.resolutionRemarks().isBlank()) {
            report.setResolutionRemarks(request.resolutionRemarks().trim());
        }

        EvaluationReport updated = reportRepository.save(report);
        return toResponse(updated);
    }

    @Transactional(readOnly = true)
    public List<ReportDtos.ReportResponse> getStudentReports(User student) {
        if (student.getRole() != UserRole.STUDENT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student account required");
        }
        return reportRepository.findByStudentIdOrderByCreatedAtDesc(student.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void autoResolveForSubmission(Submission submission) {
        if (submission == null || submission.getId() == null) return;

        List<EvaluationReport> reports = reportRepository.findBySubmissionIdAndStatus(submission.getId(), ReportStatus.PENDING);
        for (EvaluationReport r : reports) {
            r.setStatus(ReportStatus.RESOLVED);
            r.setResolvedAt(LocalDateTime.now());
            if (r.getResolutionRemarks() == null || r.getResolutionRemarks().isBlank()) {
                r.setResolutionRemarks("Auto-resolved upon instructor score revision.");
            }
        }
        if (!reports.isEmpty()) {
            reportRepository.saveAll(reports);
        }

        // Also check if there's any report by student and questionSet and questionNumber
        if (submission.getQuestion() != null && submission.getQuestion().getQuestionSet() != null) {
            UUID setId = submission.getQuestion().getQuestionSet().getId();
            UUID studentId = submission.getStudent().getId();
            Integer qNum = submission.getQuestion().getQuestionOrder();

            List<EvaluationReport> bySetAndStudent = reportRepository.findByQuestionSetIdAndStudentId(setId, studentId);
            for (EvaluationReport r : bySetAndStudent) {
                if (r.getStatus() == ReportStatus.PENDING && (r.getQuestionNumber() == null || r.getQuestionNumber().equals(qNum))) {
                    r.setStatus(ReportStatus.RESOLVED);
                    r.setResolvedAt(LocalDateTime.now());
                    if (r.getResolutionRemarks() == null || r.getResolutionRemarks().isBlank()) {
                        r.setResolutionRemarks("Auto-resolved upon instructor score revision.");
                    }
                    reportRepository.save(r);
                }
            }
        }
    }

    public ReportDtos.ReportResponse toResponse(EvaluationReport r) {
        User s = r.getStudent();
        QuestionSet qs = r.getQuestionSet();

        return new ReportDtos.ReportResponse(
                r.getId(),
                s != null ? s.getId() : null,
                s != null ? s.getFullName() : "Student",
                s != null ? s.getUsn() : null,
                s != null ? s.getEmail() : null,
                qs != null ? qs.getId() : null,
                qs != null ? qs.getTitle() : "Assessment",
                qs != null ? qs.getSubject() : null,
                r.getSubmission() != null ? r.getSubmission().getId() : null,
                r.getQuestionNumber(),
                r.getReason(),
                r.getStatus(),
                r.getResolutionRemarks(),
                r.getCreatedAt(),
                r.getResolvedAt()
        );
    }
}
