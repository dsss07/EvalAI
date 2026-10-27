package com.example.answereval.dto;

import java.util.UUID;

public record EvaluationMessage(
        UUID submissionId,
        UUID questionId,
        String extractedAnswerText
) {
}
