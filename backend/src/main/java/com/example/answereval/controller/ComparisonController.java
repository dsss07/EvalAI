package com.example.answereval.controller;

import com.example.answereval.entity.*;
import com.example.answereval.repository.QuestionRepository;
import com.example.answereval.repository.SubmissionRepository;
import com.example.answereval.service.QuestionSetService;
import com.example.answereval.security.UserPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/question-sets")
public class ComparisonController {

    private final QuestionSetService questionSetService;
    private final QuestionRepository questionRepository;
    private final SubmissionRepository submissionRepository;

    public ComparisonController(
            QuestionSetService questionSetService,
            QuestionRepository questionRepository,
            SubmissionRepository submissionRepository
    ) {
        this.questionSetService = questionSetService;
        this.questionRepository = questionRepository;
        this.submissionRepository = submissionRepository;
    }

    @GetMapping("/{setId}/comparison")
    @PreAuthorize("hasRole('TEACHER')")
    public Map<String, Object> comparison(
            @PathVariable UUID setId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        QuestionSet set = questionSetService.findOwnedSet(setId, principal.getUser());
        List<Map<String, Object>> perQuestion = new ArrayList<>();
        int totalBoth = 0;
        int totalAgree = 0;

        for (Question question : questionRepository.findByQuestionSetIdOrderByQuestionOrderAsc(setId)) {
            List<Submission> submissions = submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(setId)
                    .stream()
                    .filter(submission -> submission.getQuestion().getId().equals(question.getId()))
                    .toList();

            List<Double> ai = new ArrayList<>();
            List<Double> teacher = new ArrayList<>();
            List<Map<String, Object>> details = new ArrayList<>();

            for (Submission submission : submissions) {
                Grade aiGrade = submission.getGrades().stream()
                        .filter(grade -> grade.getGraderType() == GraderType.AI)
                        .max(Comparator.comparing(Grade::getCreatedAt))
                        .orElse(null);
                Grade teacherGrade = submission.getGrades().stream()
                        .filter(grade -> grade.getGraderType() == GraderType.TEACHER)
                        .max(Comparator.comparing(Grade::getCreatedAt))
                        .orElse(null);

                if (aiGrade == null || teacherGrade == null) {
                    continue;
                }

                ai.add(aiGrade.getScore());
                teacher.add(teacherGrade.getScore());
                double difference = Math.round((aiGrade.getScore() - teacherGrade.getScore()) * 100.0) / 100.0;
                details.add(Map.of(
                        "submission_id", submission.getId(),
                        "student_name", submission.getStudent().getFullName(),
                        "question_text", question.getQuestionText(),
                        "teacher_score", teacherGrade.getScore(),
                        "ai_score", aiGrade.getScore(),
                        "max_score", question.getMaxMarks(),
                        "difference", difference
                ));

                totalBoth++;
                if (Math.abs(difference) <= question.getMaxMarks() * 0.10) {
                    totalAgree++;
                }
            }

            double avgAi = average(ai);
            double avgTeacher = average(teacher);
            double avgDifference = avgAi - avgTeacher;
            double agreement = ai.isEmpty() ? 0.0 : totalAgreement(ai, teacher, question.getMaxMarks());

            Map<String, Object> questionSummary = new LinkedHashMap<>();
            questionSummary.put("question_id", question.getId());
            questionSummary.put("question_text", question.getQuestionText());
            questionSummary.put("max_marks", question.getMaxMarks());
            questionSummary.put("total_submissions", submissions.size());
            questionSummary.put("graded_by_both", ai.size());
            questionSummary.put("avg_teacher_score", round(avgTeacher));
            questionSummary.put("avg_ai_score", round(avgAi));
            questionSummary.put("avg_difference", round(avgDifference));
            questionSummary.put("agreement_pct", round(agreement));
            questionSummary.put("bias", Math.abs(avgDifference) <= question.getMaxMarks() * 0.10 ? "agrees" : (avgDifference > 0 ? "over-grades" : "under-grades"));
            questionSummary.put("submissions_detail", details);
            perQuestion.add(questionSummary);
        }

        return Map.of(
                "set_id", setId,
                "set_title", set.getTitle(),
                "grading_mode", set.getGradingMode().name().toLowerCase(),
                "overall_agreement_pct", totalBoth == 0 ? 0.0 : round(100.0 * totalAgree / totalBoth),
                "total_graded_by_both", totalBoth,
                "per_question", perQuestion
        );
    }

    private double totalAgreement(List<Double> ai, List<Double> teacher, double maxMarks) {
        if (ai.isEmpty()) return 0.0;
        int agree = 0;
        for (int i = 0; i < ai.size(); i++) {
            if (Math.abs(ai.get(i) - teacher.get(i)) <= maxMarks * 0.10) {
                agree++;
            }
        }
        return 100.0 * agree / ai.size();
    }

    private double average(List<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
