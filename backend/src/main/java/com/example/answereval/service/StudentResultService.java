package com.example.answereval.service;

import com.example.answereval.entity.*;
import com.example.answereval.repository.MCQAnswerRepository;
import com.example.answereval.repository.MCQQuestionRepository;
import com.example.answereval.repository.SubmissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class StudentResultService {

    private final SubmissionRepository submissionRepository;
    private final MCQAnswerRepository mcqAnswerRepository;
    private final MCQQuestionRepository mcqQuestionRepository;

    public StudentResultService(
            SubmissionRepository submissionRepository,
            MCQAnswerRepository mcqAnswerRepository,
            MCQQuestionRepository mcqQuestionRepository
    ) {
        this.submissionRepository = submissionRepository;
        this.mcqAnswerRepository = mcqAnswerRepository;
        this.mcqQuestionRepository = mcqQuestionRepository;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> results(User student) {
        Map<UUID, List<Submission>> bySet = submissionRepository.findByStudentIdOrderBySubmittedAtDesc(student.getId())
                .stream()
                .filter(Submission::isFinalSubmission)
                .collect(Collectors.groupingBy(submission -> submission.getQuestion().getQuestionSet().getId()));

        List<Map<String, Object>> result = new ArrayList<>();
        for (List<Submission> submissions : bySet.values()) {
            QuestionSet set = submissions.get(0).getQuestion().getQuestionSet();
            double score = submissions.stream().mapToDouble(this::finalScore).sum();
            double max = set.getQuestions().stream().mapToDouble(Question::getMaxMarks).sum();

            Map<UUID, Submission> submissionByQuestionId = submissions.stream()
                    .collect(Collectors.toMap(s -> s.getQuestion().getId(), s -> s, (s1, s2) -> s1));

            List<Map<String, Object>> descriptiveAnswers = new ArrayList<>();
            List<Question> sortedQuestions = set.getQuestions().stream()
                    .sorted(Comparator.comparing(Question::getQuestionOrder, Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();

            for (int i = 0; i < sortedQuestions.size(); i++) {
                Question q = sortedQuestions.get(i);
                Submission sub = submissionByQuestionId.get(q.getId());
                Map<String, Object> ansMap = new LinkedHashMap<>();
                ansMap.put("question_id", q.getId());
                ansMap.put("question_number", q.getQuestionOrder() != null && q.getQuestionOrder() > 0 ? q.getQuestionOrder() : (i + 1));
                ansMap.put("question_text", q.getQuestionText());
                ansMap.put("max_marks", q.getMaxMarks());

                if (sub != null) {
                    ansMap.put("student_answer", sub.getAnswerText() != null ? sub.getAnswerText() : "");
                    ansMap.put("image_url", sub.getImageUrl());
                    ansMap.put("score_awarded", finalScore(sub));
                    ansMap.put("is_final", sub.isFinalSubmission());

                    Grade aiGrade = sub.getGrades().stream()
                            .filter(g -> g.getGraderType() == GraderType.AI)
                            .max(Comparator.comparing(Grade::getCreatedAt))
                            .orElse(null);

                    String aiFeedback = "";
                    List<String> missingConcepts = List.of();
                    if (aiGrade != null && aiGrade.getBreakdown() != null) {
                        aiFeedback = String.valueOf(aiGrade.getBreakdown().getOrDefault("feedback", ""));
                        Object mc = aiGrade.getBreakdown().get("missing_concepts");
                        if (mc instanceof List<?> l) {
                            missingConcepts = l.stream().map(String::valueOf).toList();
                        }
                    }

                    Grade teacherGrade = sub.getGrades().stream()
                            .filter(g -> g.getGraderType() == GraderType.TEACHER)
                            .max(Comparator.comparing(Grade::getCreatedAt))
                            .orElse(null);
                    if (teacherGrade != null && teacherGrade.getBreakdown() != null && teacherGrade.getBreakdown().containsKey("remarks")) {
                        ansMap.put("teacher_remarks", String.valueOf(teacherGrade.getBreakdown().get("remarks")));
                    }

                    ansMap.put("ai_feedback", aiFeedback);
                    ansMap.put("missing_concepts", missingConcepts);
                } else {
                    ansMap.put("student_answer", "");
                    ansMap.put("image_url", null);
                    ansMap.put("score_awarded", 0.0);
                    ansMap.put("is_final", true);
                    ansMap.put("ai_feedback", "No submission was recorded for this question.");
                    ansMap.put("missing_concepts", List.of());
                }

                descriptiveAnswers.add(ansMap);
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("set_id", set.getId());
            response.put("set_title", set.getTitle());
            response.put("subject", set.getSubject() != null ? set.getSubject() : "");
            response.put("total_score", score);
            response.put("max_score", max);
            response.put("is_final", true);
            response.put("test_type", set.getTestType() != null ? set.getTestType().name() : "DESCRIPTIVE");
            response.put("status", "COMPLETED");
            response.put("descriptive_answers", descriptiveAnswers);
            result.add(response);
        }

        Map<UUID, List<MCQAnswer>> mcqBySet = mcqAnswerRepository.findByStudentId(student.getId())
                .stream()
                .collect(Collectors.groupingBy(answer -> answer.getQuestionSet().getId()));

        for (Map.Entry<UUID, List<MCQAnswer>> entry : mcqBySet.entrySet()) {
            List<MCQAnswer> answers = entry.getValue();
            if (answers.isEmpty() || answers.get(0).getQuestionSet().getStatus() != TestStatus.COMPLETED) {
                continue;
            }

            QuestionSet set = answers.get(0).getQuestionSet();
            double score = answers.stream().mapToDouble(MCQAnswer::getMarksAwarded).sum();
            double max = mcqQuestionRepository.findByQuestionSetId(set.getId()).stream()
                    .mapToDouble(MCQQuestion::getMarks)
                    .sum();

            List<Map<String, Object>> details = answers.stream().map(answer -> Map.<String, Object>of(
                    "question_id", answer.getQuestion().getId(),
                    "question_text", answer.getQuestion().getQuestionText(),
                    "options", answer.getQuestion().getOptions(),
                    "selected_option", answer.getSelectedOption() == null ? "" : answer.getSelectedOption(),
                    "correct_option", answer.getQuestion().getCorrectOption(),
                    "is_correct", answer.isCorrect(),
                    "marks_awarded", answer.getMarksAwarded(),
                    "max_marks", answer.getQuestion().getMarks(),
                    "is_grace_awarded", answer.getQuestion().isGraceAwarded()
            )).toList();

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("set_id", set.getId());
            response.put("set_title", set.getTitle());
            response.put("total_score", score);
            response.put("max_score", max);
            response.put("is_final", true);
            response.put("test_type", set.getTestType());
            response.put("status", "COMPLETED");
            response.put("mcq_answers", details);
            result.add(response);
        }

        return result;
    }

    private double finalScore(Submission submission) {
        return submission.getGrades().stream()
                .filter(grade -> grade.getGraderType() == GraderType.TEACHER)
                .max(Comparator.comparing(Grade::getCreatedAt))
                .or(() -> submission.getGrades().stream()
                        .filter(grade -> grade.getGraderType() == GraderType.AI)
                        .max(Comparator.comparing(Grade::getCreatedAt)))
                .map(Grade::getScore)
                .orElse(0.0);
    }
}
