package com.example.answereval.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SubmissionProgressEvent(
        @JsonProperty("submissionId") UUID submissionId,
        @JsonProperty("questionSetId") UUID questionSetId,
        @JsonProperty("stage") String stage,
        @JsonProperty("progressPercentage") int progressPercentage,
        @JsonProperty("message") String message,
        @JsonProperty("timestamp") OffsetDateTime timestamp
) {
    @JsonProperty("submission_id")
    public UUID submissionIdSnake() {
        return submissionId;
    }

    @JsonProperty("question_set_id")
    public UUID questionSetIdSnake() {
        return questionSetId;
    }

    @JsonProperty("progress_percentage")
    public int progressPercentageSnake() {
        return progressPercentage;
    }

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
