package com.example.answereval.dto;

public record QuestionScoreItem(
        int questionNumber,
        String questionText,
        double scoreAwarded,
        double maxMarks
) {
}
