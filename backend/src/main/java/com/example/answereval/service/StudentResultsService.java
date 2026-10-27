package com.example.answereval.service;

import com.example.answereval.entity.Grade;
import com.example.answereval.entity.GraderType;
import com.example.answereval.entity.Question;
import com.example.answereval.entity.QuestionSet;
import com.example.answereval.entity.Submission;
import com.example.answereval.repository.SubmissionRepository;
import com.example.answereval.security.UserPrincipal;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StudentResultsService {

    private final QuestionSetService questionSetService;
    private final SubmissionRepository submissionRepository;

    public StudentResultsService(
            QuestionSetService questionSetService,
            SubmissionRepository submissionRepository
    ) {
        this.questionSetService = questionSetService;
        this.submissionRepository = submissionRepository;
    }

    @Transactional
    public List<Map<String, Object>> getStudentResults(
            UUID id,
            UserPrincipal principal
    ) {
        QuestionSet set = questionSetService.findOwnedSet(
                id, principal.getUser()
        );

        List<Submission> submissions =
                submissionRepository
                        .findByQuestionQuestionSetIdOrderBySubmittedAtDesc(id);

        Map<UUID, List<Submission>> grouped = submissions.stream()
                .collect(Collectors.groupingBy(
                        s -> s.getStudent().getId()
                ));

        double maxScore = set.getQuestions().stream()
                .mapToDouble(Question::getMaxMarks)
                .sum();

        List<Map<String, Object>> result = new ArrayList<>();

        for (List<Submission> studentSubmissions : grouped.values()) {
            Submission first = studentSubmissions.get(0);
            double total = 0.0;

            for (Submission submission : studentSubmissions) {
                Grade grade = submission.getGrades().stream()
                        .filter(g -> g.getGraderType() == GraderType.TEACHER)
                        .max(Comparator.comparing(Grade::getCreatedAt))
                        .orElseGet(() ->
                                submission.getGrades().stream()
                                        .filter(g -> g.getGraderType() == GraderType.AI)
                                        .max(Comparator.comparing(Grade::getCreatedAt))
                                        .orElse(null)
                        );

                if (grade != null) {
                    total += grade.getScore();
                }
            }

            boolean finalised = studentSubmissions.stream()
                    .allMatch(Submission::isFinalSubmission);

            Map<String, Object> row = new HashMap<>();
            row.put("student_id", first.getStudent().getId());
            row.put("student_name", first.getStudent().getFullName());
            row.put("student_usn",
                    first.getStudent().getUsn() == null
                            ? "" : first.getStudent().getUsn());
            row.put("total_score", total);
            row.put("max_score", maxScore);
            row.put("status", finalised ? "finalized" : "graded");
            row.put("is_final", finalised);

            result.add(row);
        }

        return result;
    }
}