package com.example.answereval.controller;

import com.example.answereval.dto.AnalyticsDtos;
import com.example.answereval.security.UserPrincipal;
import com.example.answereval.service.AnalyticsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/teacher/dashboard")
    @PreAuthorize("hasRole('TEACHER')")
    public AnalyticsDtos.Dashboard dashboard(
            @RequestParam(required = false) Integer semester,
            @RequestParam(required = false) String section,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String subject,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return analyticsService.teacherDashboard(
                principal.getUser(),
                semester,
                section,
                branch,
                subject
        );
    }
}
