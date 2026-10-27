package com.example.answereval.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ExamNotStartedException.class)
    public ResponseEntity<Map<String, Object>> handleExamNotStarted(ExamNotStartedException ex) {
        log.warn("Submission rejected - exam not started: {}", ex.getMessage());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "EXAM_NOT_STARTED");
        body.put("message", ex.getMessage());
        body.put("server_time", OffsetDateTime.now());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(ExamDeadlineExceededException.class)
    public ResponseEntity<Map<String, Object>> handleExamDeadlineExceeded(ExamDeadlineExceededException ex) {
        log.warn("Submission rejected - exam deadline exceeded: {}", ex.getMessage());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "EXAM_DEADLINE_EXCEEDED");
        body.put("message", ex.getMessage());
        body.put("server_time", OffsetDateTime.now());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(DuplicateSubmissionException.class)
    public ResponseEntity<Map<String, Object>> handleDuplicateSubmission(DuplicateSubmissionException ex) {
        log.warn("Submission rejected - duplicate submission: {}", ex.getMessage());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "DUPLICATE_SUBMISSION");
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        log.warn("Database constraint violation (likely concurrent submission): {}", ex.getMessage());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "DUPLICATE_SUBMISSION");
        body.put("message", "Concurrent duplicate submission detected.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(ResponseStatusException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getStatusCode().toString());
        body.put("message", ex.getReason() == null ? ex.getMessage() : ex.getReason());
        return ResponseEntity.status(ex.getStatusCode()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(MethodArgumentNotValidException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "VALIDATION_FAILED");
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(fe -> fieldErrors.put(fe.getField(), fe.getDefaultMessage()));
        body.put("field_errors", fieldErrors);

        String firstErrorMessage = fieldErrors.entrySet().stream()
                .map(e -> e.getKey() + ": " + e.getValue())
                .findFirst()
                .orElse("Validation failed");
        body.put("message", firstErrorMessage);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
