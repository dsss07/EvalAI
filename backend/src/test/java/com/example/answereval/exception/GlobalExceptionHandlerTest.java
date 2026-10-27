package com.example.answereval.exception;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void shouldHandleExamNotStartedException() {
        ExamNotStartedException ex = new ExamNotStartedException("Exam starts at 10:00 AM");
        ResponseEntity<Map<String, Object>> response = handler.handleExamNotStarted(ex);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("EXAM_NOT_STARTED", response.getBody().get("error"));
        assertEquals("Exam starts at 10:00 AM", response.getBody().get("message"));
        assertNotNull(response.getBody().get("server_time"));
    }

    @Test
    void shouldHandleExamDeadlineExceededException() {
        ExamDeadlineExceededException ex = new ExamDeadlineExceededException("Exam deadline passed");
        ResponseEntity<Map<String, Object>> response = handler.handleExamDeadlineExceeded(ex);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("EXAM_DEADLINE_EXCEEDED", response.getBody().get("error"));
        assertEquals("Exam deadline passed", response.getBody().get("message"));
        assertNotNull(response.getBody().get("server_time"));
    }

    @Test
    void shouldHandleDuplicateSubmissionException() {
        DuplicateSubmissionException ex = new DuplicateSubmissionException("Already submitted");
        ResponseEntity<Map<String, Object>> response = handler.handleDuplicateSubmission(ex);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("DUPLICATE_SUBMISSION", response.getBody().get("error"));
        assertEquals("Already submitted", response.getBody().get("message"));
    }

    @Test
    void shouldHandleDataIntegrityViolationException() {
        DataIntegrityViolationException ex = new DataIntegrityViolationException("Unique index violated");
        ResponseEntity<Map<String, Object>> response = handler.handleDataIntegrityViolation(ex);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("DUPLICATE_SUBMISSION", response.getBody().get("error"));
    }
}
