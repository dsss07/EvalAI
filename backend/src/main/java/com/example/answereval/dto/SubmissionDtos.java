package com.example.answereval.dto;

import com.example.answereval.entity.GradingMode;
import com.example.answereval.entity.GraderType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class SubmissionDtos {

    private SubmissionDtos() {
    }

    public record TextSubmissionRequest(String answerText) {
    }

    public record TeacherGradeRequest(double score, String remarks) {
    }

    public record ConfirmOcrRequest(String correctedText) {
    }

    public record ScriptSegment(UUID submissionId, UUID questionId, String correctedText) {
    }

    public record ConfirmScriptRequest(List<ScriptSegment> segments) {
    }

    public record GradeResponse(
            UUID id,
            GraderType graderType,
            UUID graderId,
            double score,
            double maxScore,
            GradingMode mode,
            Map<String, Object> breakdown,
            OffsetDateTime createdAt
    ) {
    }

    public record Response(
            UUID id,
            UUID questionId,
            UUID studentId,
            String answerText,
            OffsetDateTime submittedAt,
            boolean needsReview,
            String imageUrl,
            boolean isFinal,
            String gradingStatus,
            List<GradeResponse> grades
    ) {
    }

    public record DetailResponse(
            Response submission,
            String studentName,
            String studentUsn,
            String studentBranch,
            String questionText
    ) {
    }
}
