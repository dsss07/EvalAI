package com.example.answereval.exception;

public class ExamDeadlineExceededException extends RuntimeException {
    public ExamDeadlineExceededException(String message) {
        super(message);
    }
}
