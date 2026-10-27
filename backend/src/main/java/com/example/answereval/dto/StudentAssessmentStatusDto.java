package com.example.answereval.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record StudentAssessmentStatusDto(
        UUID setId,
        AssessmentState state,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        OffsetDateTime serverTime,
        int gracePeriodMinutes,
        boolean submitted,
        OffsetDateTime submittedAt,
        String gradingStatus,
        List<String> fileUrls
) {
}
