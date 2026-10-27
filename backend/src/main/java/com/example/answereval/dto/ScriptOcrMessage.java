package com.example.answereval.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record ScriptOcrMessage(
        UUID studentId,
        UUID questionSetId,
        List<String> filePaths,
        OffsetDateTime submittedAt
) {
}
