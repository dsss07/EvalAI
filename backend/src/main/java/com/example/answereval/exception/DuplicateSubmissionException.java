package com.example.answereval.exception;

public class DuplicateSubmissionException extends RuntimeException {
    public DuplicateSubmissionException(String message) {
        super(message);
    }

    public DuplicateSubmissionException(String message, Throwable cause) {
        super(message, cause);
    }
}
