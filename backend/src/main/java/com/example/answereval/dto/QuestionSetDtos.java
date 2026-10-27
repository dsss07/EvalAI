package com.example.answereval.dto;

import com.example.answereval.entity.*;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class QuestionSetDtos {

    private QuestionSetDtos() {
    }

    public record CreateRequest(
            @NotBlank String title,
            String description,
            Integer semester,
            String section,
            String branch,
            String subject,
            GradingMode gradingMode,
            TestType testType,
            List<UUID> eligibleStudentIds,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            Integer durationMinutes,
            Integer gracePeriodMinutes
    ) {
        public CreateRequest(
                String title,
                String description,
                Integer semester,
                String section,
                String branch,
                String subject,
                GradingMode gradingMode,
                TestType testType,
                List<UUID> eligibleStudentIds,
                Integer gracePeriodMinutes
        ) {
            this(title, description, semester, section, branch, subject, gradingMode, testType, eligibleStudentIds, null, null, null, gracePeriodMinutes);
        }
    }

    public record Create(
            @NotBlank String title,
            String description,
            Integer semester,
            String section,
            String branch,
            String subject,
            GradingMode gradingMode,
            TestType testType,
            List<UUID> eligibleStudentIds,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            Integer durationMinutes,
            Integer gracePeriodMinutes
    ) {
    }

    public record PublishRequest(
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            Integer durationMinutes,
            Integer gracePeriodMinutes
    ) {
    }

    public record CreateQuestionRequest(
            @NotBlank String questionText,
            @NotBlank String answerKey,
            Integer maxMarks,
            Integer order,
            String rubric
    ) {
        public CreateQuestionRequest(String questionText, String answerKey, Integer maxMarks, Integer order) {
            this(questionText, answerKey, maxMarks, order, null);
        }
    }

    public record UpdateQuestionRequest(
            String questionText,
            String answerKey,
            Integer maxMarks,
            Integer order,
            String rubric
    ) {
        public UpdateQuestionRequest(String questionText, String answerKey, Integer maxMarks, Integer order) {
            this(questionText, answerKey, maxMarks, order, null);
        }
    }

    public record QuestionResponse(
            UUID id,
            UUID setId,
            String questionText,
            String answerKey,
            Integer maxMarks,
            Integer order,
            Map<String, String> options,
            String rubric
    ) {
        public QuestionResponse(UUID id, UUID setId, String questionText, String answerKey, Integer maxMarks, Integer order) {
            this(id, setId, questionText, answerKey, maxMarks, order, null, null);
        }

        public QuestionResponse(UUID id, UUID setId, String questionText, String answerKey, Integer maxMarks, Integer order, Map<String, String> options) {
            this(id, setId, questionText, answerKey, maxMarks, order, options, null);
        }
    }

    public record Response(
            UUID id,
            String title,
            String description,
            Integer semester,
            String section,
            String branch,
            String subject,
            GradingMode gradingMode,
            UUID teacherId,
            TestType testType,
            TestStatus status,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            Integer durationMinutes,
            Integer gracePeriodMinutes,
            OffsetDateTime createdAt
    ) {
    }

    public record DetailResponse(
            Response set,
            String teacherName,
            List<QuestionResponse> questions
    ) {
    }
}
