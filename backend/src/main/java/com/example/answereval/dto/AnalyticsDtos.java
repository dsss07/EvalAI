package com.example.answereval.dto;

import java.util.List;
import java.util.UUID;

public final class AnalyticsDtos {

    private AnalyticsDtos() {
    }

    public record Bucket(
            String name,
            double averagePercentage,
            double averageScore,
            int count
    ) {
    }

    public record StudentMetric(
            UUID studentId,
            String name,
            String usn,
            double score,
            double maxScore,
            double percentage
    ) {
    }

    public record Summary(
            int students,
            int assessments,
            double averagePercentage,
            double highestPercentage,
            double lowestPercentage
    ) {
    }

    public record Dashboard(
            Summary summary,
            List<Bucket> subjectWise,
            List<StudentMetric> studentWise,
            List<Bucket> classWise,
            List<Bucket> examWise
    ) {
    }
}
