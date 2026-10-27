package com.example.answereval.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class McqDtos {

    private McqDtos() {
    }

    public record CreateRequest(
            String questionText,
            Map<String, String> options,
            String correctOption,
            double marks
    ) {
    }

    public record Response(
            UUID id,
            String questionText,
            Map<String, String> options,
            String correctOption,
            double marks,
            boolean graceAwarded
    ) {
    }

    public record StudentResponse(
            UUID id,
            String questionText,
            Map<String, String> options
    ) {
    }

    public record StudentTest(
            UUID questionSetId,
            String title,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            Integer durationMinutes,
            List<StudentResponse> questions
    ) {
    }

    public record Answer(UUID questionId, String selectedOption) {
    }

    public record SubmissionRequest(List<Answer> answers) {
    }
}
