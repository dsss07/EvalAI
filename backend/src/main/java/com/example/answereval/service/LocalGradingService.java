package com.example.answereval.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
public class LocalGradingService {

    private static final Logger logger = LoggerFactory.getLogger(LocalGradingService.class);
    private final RestClient restClient;

    public LocalGradingService(
            RestClient.Builder restClientBuilder,
            @Value("${app.python-service.base-url:http://localhost:8001}") String baseUrl
    ) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
    }

    public LocalGradeResult grade(String studentAnswer, String answerKey, double maxMarks, String mode) {
        try {
            Map<String, Object> response = restClient.post()
                    .uri("/grade/local")
                    .body(Map.of(
                            "student_answer", studentAnswer == null ? "" : studentAnswer,
                            "answer_key", answerKey == null ? "" : answerKey,
                            "max_marks", maxMarks,
                            "mode", mode == null ? "mid" : mode.toLowerCase()
                    ))
                    .retrieve()
                    .body(Map.class);

            if (response == null) {
                return null;
            }
            return new LocalGradeResult(
                    number(response.get("score"), 0.0),
                    number(response.get("similarity_score"), 0.0),
                    number(response.get("keyword_ratio"), 0.0),
                    strings(response.get("keywords")),
                    strings(response.get("keywords_matched")),
                    strings(response.get("keywords_missed")),
                    String.valueOf(response.getOrDefault("mode", mode))
            );
        } catch (Exception exception) {
            logger.warn("Python local grading service unavailable; using basic fallback: {}", exception.getMessage());
            return null;
        }
    }

    private double number(Object value, double fallback) {
        return value instanceof Number number ? number.doubleValue() : fallback;
    }

    private List<String> strings(Object value) {
        if (!(value instanceof List<?> values)) {
            return List.of();
        }
        return values.stream().map(String::valueOf).toList();
    }

    public record LocalGradeResult(
            double score,
            double similarityScore,
            double keywordRatio,
            List<String> keywords,
            List<String> keywordsMatched,
            List<String> keywordsMissed,
            String mode
    ) {
    }
}
