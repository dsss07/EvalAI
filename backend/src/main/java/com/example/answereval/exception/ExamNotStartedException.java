package com.example.answereval.exception;

public class ExamNotStartedException extends RuntimeException {
    public ExamNotStartedException(String message) {
        super(message);
    }
}
