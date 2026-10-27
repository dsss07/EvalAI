package com.example.answereval.controller;

import com.example.answereval.dto.McqDtos;
import com.example.answereval.security.UserPrincipal;
import com.example.answereval.service.McqService;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/question-sets")
public class McqController {

    private final McqService mcqService;

    public McqController(McqService mcqService) {
        this.mcqService = mcqService;
    }

    @PostMapping("/{setId}/extract-mcqs")
    @PreAuthorize("hasRole('TEACHER')")
    public List<McqDtos.Response> extract(
            @PathVariable UUID setId,
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal principal
    ) throws IOException {
        return mcqService.extractFromPdf(setId, file, principal.getUser());
    }

    @GetMapping("/{setId}/mcq-questions")
    @PreAuthorize("hasRole('TEACHER')")
    public List<McqDtos.Response> list(
            @PathVariable UUID setId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return mcqService.list(setId, principal.getUser());
    }

    @PutMapping("/{setId}/mcq-questions/{questionId}")
    @PreAuthorize("hasRole('TEACHER')")
    public McqDtos.Response update(
            @PathVariable UUID setId,
            @PathVariable UUID questionId,
            @RequestBody McqDtos.CreateRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return mcqService.update(setId, questionId, request, principal.getUser());
    }

    @DeleteMapping("/{setId}/mcq-questions/{questionId}")
    @PreAuthorize("hasRole('TEACHER')")
    public Map<String, String> delete(
            @PathVariable UUID setId,
            @PathVariable UUID questionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        mcqService.delete(setId, questionId, principal.getUser());
        return Map.of("message", "Question deleted");
    }

    @PostMapping("/{setId}/questions/{questionId}/grace-marks")
    @PreAuthorize("hasRole('TEACHER')")
    public Map<String, String> grace(
            @PathVariable UUID setId,
            @PathVariable UUID questionId,
            @RequestBody Map<String, Double> body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        mcqService.awardGrace(setId, questionId, body.getOrDefault("grace_marks", 0.0), principal.getUser());
        return Map.of("message", "Grace marks applied");
    }

    @GetMapping("/{setId}/mcq-analytics")
    @PreAuthorize("hasRole('TEACHER')")
    public Map<String, Object> analytics(
            @PathVariable UUID setId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<McqDtos.Response> questions = mcqService.list(setId, principal.getUser());
        return Map.of("questions", questions);
    }

    @PostMapping("/{setId}/finalize")
    @PreAuthorize("hasRole('TEACHER')")
    public Map<String, String> finalizeTest(
            @PathVariable UUID setId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        mcqService.finalizeTest(setId, principal.getUser());
        return Map.of("message", "MCQ test finalized");
    }

    @PostMapping(value = "/{setId}/mcq-questions", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('TEACHER')")
    public List<McqDtos.Response> create(
            @PathVariable UUID setId,
            @RequestBody List<McqDtos.CreateRequest> requests,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return mcqService.createMany(setId, requests, principal.getUser());
    }
}
