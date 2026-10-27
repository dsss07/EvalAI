package com.example.answereval.controller;

import com.example.answereval.security.UserPrincipal;
import com.example.answereval.service.StudentResultService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/question-sets/student")
public class StudentResultController {

    private final StudentResultService studentResultService;

    public StudentResultController(StudentResultService studentResultService) {
        this.studentResultService = studentResultService;
    }

    @GetMapping("/results")
    @PreAuthorize("hasRole('STUDENT')")
    public List<Map<String, Object>> results(@AuthenticationPrincipal UserPrincipal principal) {
        return studentResultService.results(principal.getUser());
    }
}
