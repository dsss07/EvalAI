package com.example.answereval.controller;

import com.example.answereval.dto.QuestionSetDtos;
import com.example.answereval.dto.StudentAssessmentStatusDto;
import com.example.answereval.entity.User;
import com.example.answereval.entity.UserRole;
import com.example.answereval.security.UserPrincipal;
import com.example.answereval.service.QuestionSetService;
import com.example.answereval.service.StudentResultsService;
import com.example.answereval.repository.SubmissionRepository;
import com.example.answereval.entity.Grade;
import com.example.answereval.entity.GraderType;
import com.example.answereval.entity.Question;
import com.example.answereval.entity.QuestionSet;
import com.example.answereval.entity.Submission;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/question-sets")
public class QuestionSetController {

    private final QuestionSetService questionSetService;
    private final SubmissionRepository submissionRepository;
    private final StudentResultsService studentResultsService;

    public QuestionSetController(
            QuestionSetService questionSetService,
            SubmissionRepository submissionRepository,
            StudentResultsService studentResultsService
    ){
        this.questionSetService = questionSetService;
            this.submissionRepository = submissionRepository;
            this.studentResultsService = studentResultsService;
        }

    @PostMapping
    @PreAuthorize("hasRole('TEACHER')")
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionSetDtos.Response create(
            @Valid @RequestBody QuestionSetDtos.CreateRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return questionSetService.create(request, principal.getUser());
    }

    @GetMapping
    public List<QuestionSetDtos.Response> list(@AuthenticationPrincipal UserPrincipal principal) {
        return questionSetService.list(principal.getUser());
    }

    @GetMapping("/{id}")
    public QuestionSetDtos.DetailResponse get(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return questionSetService.get(id, principal.getUser());
    }

    @GetMapping("/{id}/my-status")
    @PreAuthorize("hasRole('STUDENT')")
    public StudentAssessmentStatusDto myStatus(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return questionSetService.getStudentAssessmentStatus(id, principal.getUser());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('TEACHER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        questionSetService.delete(id, principal.getUser());
    }

    @PostMapping("/{id}/questions")
    @PreAuthorize("hasRole('TEACHER')")
    public QuestionSetDtos.QuestionResponse addQuestion(
            @PathVariable UUID id,
            @Valid @RequestBody QuestionSetDtos.CreateQuestionRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return questionSetService.addQuestion(id, request, principal.getUser());
    }

    @PutMapping("/questions/{questionId}")
    @PreAuthorize("hasRole('TEACHER')")
    public QuestionSetDtos.QuestionResponse updateQuestion(
            @PathVariable UUID questionId,
            @RequestBody QuestionSetDtos.UpdateQuestionRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return questionSetService.updateQuestion(questionId, request, principal.getUser());
    }

    @GetMapping("/{id}/student-results")
    @PreAuthorize("hasRole('TEACHER')")
    public List<java.util.Map<String, Object>> studentResults(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return studentResultsService.getStudentResults(id, principal);
    }
    
    @PostMapping("/{id}/publish")
    @PreAuthorize("hasRole('TEACHER')")
    public java.util.Map<String, String> publish(
            @PathVariable UUID id,
            @RequestBody QuestionSetDtos.PublishRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        questionSetService.publish(id, request, principal.getUser());
        return java.util.Map.of("message", "Question set published");
    }

    @PostMapping("/{id}/finalize-all")
    @PreAuthorize("hasRole('TEACHER')")
    public java.util.Map<String, String> finalizeAll(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        questionSetService.finalizeAll(id, principal.getUser());
        return java.util.Map.of("message", "All submissions finalized");
    }
}
