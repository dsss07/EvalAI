package com.example.answereval.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SubmissionProgressEvent(
        UUID submissionId,
        UUID questionSetId,
        String stage,
        int progressPercentage,
        String message,
        OffsetDateTime timestamp
) {
    public static SubmissionProgressEvent of(
            UUID submissionId,
            UUID questionSetId,
            String stage,
            int progressPercentage,
            String message
    ) {
        return new SubmissionProgressEvent(
                submissionId,
                questionSetId,
                stage,
                progressPercentage,
                message,
                OffsetDateTime.now()
        );
    }
}
