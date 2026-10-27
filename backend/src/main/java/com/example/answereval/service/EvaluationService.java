package com.example.answereval.service;

import com.example.answereval.entity.*;
import com.example.answereval.repository.GradeRepository;
import com.example.answereval.repository.SubmissionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
public class EvaluationService {

    private static final Logger log = LoggerFactory.getLogger(EvaluationService.class);

    private static final Map<String, Double> LLM_WEIGHTS = Map.of(
            "easy", 0.40,
            "mid", 0.50,
            "hard", 0.60
    );

    private final SubmissionRepository submissionRepository;
    private final GradeRepository gradeRepository;
    private final GeminiService geminiService;
    private final LocalGradingService localGradingService;

    public EvaluationService(
            SubmissionRepository submissionRepository,
            GradeRepository gradeRepository,
            GeminiService geminiService,
            LocalGradingService localGradingService
    ) {
        this.submissionRepository = submissionRepository;
        this.gradeRepository = gradeRepository;
        this.geminiService = geminiService;
        this.localGradingService = localGradingService;
    }

    @Transactional
    public void evaluate(UUID submissionId) {
        Submission submission = submissionRepository.findById(submissionId).orElse(null);
        if (submission == null) {
            log.warn("Submission {} not found for evaluation", submissionId);
            return;
        }

        submission.setGradingStatus("PROCESSING");
        submissionRepository.save(submission);

        Question question = submission.getQuestion();
        String mode = question.getQuestionSet().getGradingMode().value();
        String studentAnswer = submission.getAnswerText() == null ? "" : submission.getAnswerText();
        String answerKey = question.getAnswerKey() == null ? "" : question.getAnswerKey();
        double maxMarks = question.getMaxMarks();

        LocalGradingService.LocalGradeResult localResult = localGradingService.grade(
                studentAnswer, answerKey, maxMarks, mode
        );
        double localScore = localResult == null
                ? basicLocalScore(studentAnswer, answerKey, maxMarks)
                : localResult.score();

        GeminiService.GradingResult aiResult = geminiService.grade(
                question.getQuestionText(), question.getRubric(), studentAnswer, maxMarks, mode
        );

        double finalScore = localScore;
        String gradingMethod = "local";
        double llmWeight = LLM_WEIGHTS.getOrDefault(mode, 0.50);
        if (aiResult != null) {
            finalScore = round2((llmWeight * aiResult.score()) + ((1.0 - llmWeight) * localScore));
            finalScore = Math.max(0.0, Math.min(maxMarks, finalScore));
            gradingMethod = "blended";
        }

        Grade grade = new Grade();
        grade.setSubmission(submission);
        grade.setGraderType(GraderType.AI);
        grade.setScore(finalScore);
        grade.setMaxScore(maxMarks);
        grade.setMode(question.getQuestionSet().getGradingMode());

        Map<String, Object> breakdown = new HashMap<>();
        breakdown.put("grading_method", gradingMethod);
        breakdown.put("local_score", round2(localScore));
        breakdown.put("llm_available", aiResult != null);
        if (localResult != null) {
            breakdown.put("similarity_score", localResult.similarityScore());
            breakdown.put("keywords", localResult.keywords());
            breakdown.put("keywords_matched", localResult.keywordsMatched());
            breakdown.put("keywords_missed", localResult.keywordsMissed());
            breakdown.put("keyword_ratio", localResult.keywordRatio());
            breakdown.put("mode", localResult.mode());
        } else {
            breakdown.put("local_scoring_fallback", "basic_keyword_overlap");
        }
        if (aiResult != null) {
            breakdown.put("llm_score", aiResult.score());
            breakdown.put("llm_weight", llmWeight);
            breakdown.put("feedback", aiResult.feedback());
            breakdown.put("missing_concepts", aiResult.missingConcepts());
        } else {
            String fallbackFeedback;
            List<String> missingConcepts = new ArrayList<>();
            if (studentAnswer == null || studentAnswer.isBlank()) {
                fallbackFeedback = "No answer was provided for this question.";
            } else if (localResult != null && localResult.keywordsMissed() != null && !localResult.keywordsMissed().isEmpty()) {
                fallbackFeedback = "Scored using keyword and semantic similarity analysis. Several expected key concepts from the marking guide were partially or completely omitted.";
                missingConcepts.addAll(localResult.keywordsMissed());
            } else {
                fallbackFeedback = "Scored using keyword and semantic similarity analysis against the model answer reference.";
            }
            breakdown.put("feedback", fallbackFeedback);
            breakdown.put("missing_concepts", missingConcepts);
        }
        grade.setBreakdown(breakdown);
        gradeRepository.save(grade);

        submission.setGradingStatus("GRADED");
        submissionRepository.save(submission);
    }

    @Async("evaluationExecutor")
    @Transactional
    public CompletableFuture<Void> evaluateAsync(UUID submissionId) {
        evaluate(submissionId);
        return CompletableFuture.completedFuture(null);
    }

    private double basicLocalScore(String studentAnswer, String answerKey, double maxMarks) {
        if (studentAnswer.isBlank() || answerKey.isBlank() || maxMarks <= 0) {
            return 0.0;
        }
        String[] expectedTerms = answerKey.toLowerCase().split("\\W+");
        String answer = studentAnswer.toLowerCase();
        long usable = java.util.Arrays.stream(expectedTerms)
                .filter(term -> term.length() >= 4).distinct().count();
        if (usable == 0) {
            return 0.0;
        }
        long matched = java.util.Arrays.stream(expectedTerms)
                .filter(term -> term.length() >= 4 && answer.contains(term))
                .distinct().count();
        return Math.min(maxMarks, round2(matched * maxMarks / usable));
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
