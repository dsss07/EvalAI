package com.example.answereval.controller;

import com.example.answereval.dto.SubmissionDtos;
import com.example.answereval.security.UserPrincipal;
import com.example.answereval.service.SubmissionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class SubmissionController {

    private final SubmissionService submissionService;

    public SubmissionController(SubmissionService submissionService) {
        this.submissionService = submissionService;
    }

    @PostMapping("/questions/{questionId}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public SubmissionDtos.Response submitText(
            @PathVariable UUID questionId,
            @RequestBody SubmissionDtos.TextSubmissionRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return submissionService.submitText(questionId, request.answerText(), principal.getUser());
    }

    @PostMapping(value = "/questions/{questionId}/submit-scanned", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('STUDENT')")
    public SubmissionDtos.Response submitScanned(
            @PathVariable UUID questionId,
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal principal
    ) throws IOException {
        return submissionService.submitScanned(questionId, file, principal.getUser());
    }

    @PostMapping(value = "/question-sets/{setId}/submit-full-script", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('STUDENT')")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ResponseEntity<List<SubmissionDtos.Response>> submitFullScript(
            @PathVariable UUID setId,
            @RequestPart("files") List<MultipartFile> files,
            @AuthenticationPrincipal UserPrincipal principal
    ) throws IOException {
        List<SubmissionDtos.Response> queued = submissionService.submitFullScript(setId, files, principal.getUser());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(queued);
    }

    @GetMapping("/submissions/status")
    @PreAuthorize("hasRole('STUDENT')")
    public java.util.Map<String, List<UUID>> submittedStatus(@AuthenticationPrincipal UserPrincipal principal) {
        return java.util.Map.of("submitted_set_ids", submissionService.submittedQuestionSetIds(principal.getUser()));
    }

    @GetMapping("/submissions")
    public List<SubmissionDtos.DetailResponse> list(
            @RequestParam(required = false) UUID set_id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return submissionService.list(set_id, principal.getUser());
    }

    @GetMapping("/submissions/{submissionId}")
    public SubmissionDtos.DetailResponse get(
            @PathVariable UUID submissionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return submissionService.get(submissionId, principal.getUser());
    }

    @PostMapping("/submissions/{submissionId}/grade")
    @PreAuthorize("hasRole('TEACHER')")
    public SubmissionDtos.GradeResponse grade(
            @PathVariable UUID submissionId,
            @RequestBody SubmissionDtos.TeacherGradeRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return submissionService.teacherGrade(submissionId, request, principal.getUser());
    }

    @PostMapping("/submissions/{submissionId}/confirm-ocr")
    @PreAuthorize("hasRole('TEACHER')")
    public SubmissionDtos.Response confirmOcr(
            @PathVariable UUID submissionId,
            @RequestBody SubmissionDtos.ConfirmOcrRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return submissionService.confirmOcr(submissionId, request, principal.getUser());
    }

    @PostMapping("/submissions/confirm-script")
    @PreAuthorize("hasRole('TEACHER')")
    public List<SubmissionDtos.Response> confirmScript(
            @RequestBody SubmissionDtos.ConfirmScriptRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return submissionService.confirmScript(request, principal.getUser());
    }

    @PostMapping("/submissions/{submissionId}/finalize")
    @PreAuthorize("hasRole('TEACHER')")
    public SubmissionDtos.Response finalizeSubmission(
            @PathVariable UUID submissionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return submissionService.finalizeSubmission(submissionId, principal.getUser());
    }
}
