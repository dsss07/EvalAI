package com.example.answereval.controller;

import com.example.answereval.dto.McqDtos;
import com.example.answereval.security.UserPrincipal;
import com.example.answereval.service.McqService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/student/tests")
public class StudentMcqController {

    private final McqService mcqService;

    public StudentMcqController(McqService mcqService) {
        this.mcqService = mcqService;
    }

    @GetMapping("/{setId}/mcq-questions")
    @PreAuthorize("hasRole('STUDENT')")
    public McqDtos.StudentTest get(
            @PathVariable UUID setId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return mcqService.getStudentTest(setId, principal.getUser());
    }

    @PostMapping("/{setId}/submit-mcq")
    @PreAuthorize("hasRole('STUDENT')")
    public Map<String, Object> submit(
            @PathVariable UUID setId,
            @RequestBody McqDtos.SubmissionRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        double marks = mcqService.submit(setId, request, principal.getUser());
        return Map.of("message", "Submission successful", "total_marks", marks);
    }
}
