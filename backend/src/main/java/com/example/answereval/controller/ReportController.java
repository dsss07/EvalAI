package com.example.answereval.controller;

import com.example.answereval.dto.ReportDtos;
import com.example.answereval.entity.ReportStatus;
import com.example.answereval.security.UserPrincipal;
import com.example.answereval.service.EvaluationReportService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final EvaluationReportService reportService;

    public ReportController(EvaluationReportService reportService) {
        this.reportService = reportService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('STUDENT')")
    public ReportDtos.ReportResponse createReport(
            @Valid @RequestBody ReportDtos.CreateReportRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return reportService.createReport(request, principal.getUser());
    }

    @GetMapping("/student")
    @PreAuthorize("hasRole('STUDENT')")
    public List<ReportDtos.ReportResponse> getStudentReports(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return reportService.getStudentReports(principal.getUser());
    }

    @GetMapping("/teacher")
    @PreAuthorize("hasRole('TEACHER')")
    public List<ReportDtos.ReportResponse> getTeacherReports(
            @RequestParam(required = false) ReportStatus status,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return reportService.getTeacherReports(principal.getUser(), status);
    }

    @GetMapping("/teacher/pending-count")
    @PreAuthorize("hasRole('TEACHER')")
    public ReportDtos.PendingCountResponse getTeacherPendingCount(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return reportService.getTeacherPendingCount(principal.getUser());
    }

    @PatchMapping("/{id}/resolve")
    @PreAuthorize("hasRole('TEACHER')")
    public ReportDtos.ReportResponse resolveReport(
            @PathVariable UUID id,
            @RequestBody(required = false) ReportDtos.ResolveReportRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return reportService.resolveReport(id, request, principal.getUser());
    }
}
