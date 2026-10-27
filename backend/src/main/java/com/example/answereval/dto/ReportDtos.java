package com.example.answereval.dto;

import com.example.answereval.entity.ReportStatus;
import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.UUID;

public final class ReportDtos {

    private ReportDtos() {
    }

    public record CreateReportRequest(
            @NotNull
            @JsonAlias({"set_id", "setId"})
            UUID setId,

            @JsonAlias({"submission_id", "submissionId"})
            UUID submissionId,

            @JsonAlias({"question_number", "questionNumber"})
            Integer questionNumber,

            @NotBlank
            String reason
    ) {
    }

    public record ResolveReportRequest(
            ReportStatus status,

            @JsonAlias({"resolution_remarks", "resolutionRemarks"})
            String resolutionRemarks
    ) {
    }

    public record ReportResponse(
            UUID id,
            UUID studentId,
            String studentName,
            String studentUsn,
            String studentEmail,
            UUID setId,
            String setTitle,
            String subject,
            UUID submissionId,
            Integer questionNumber,
            String reason,
            ReportStatus status,
            String resolutionRemarks,
            LocalDateTime createdAt,
            LocalDateTime resolvedAt
    ) {
    }

    public record PendingCountResponse(
            long pendingCount
    ) {
    }
}
