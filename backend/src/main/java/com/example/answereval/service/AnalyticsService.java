package com.example.answereval.service;

import com.example.answereval.dto.AnalyticsDtos;
import com.example.answereval.entity.*;
import com.example.answereval.repository.SubmissionRepository;
import com.example.answereval.repository.QuestionSetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private final QuestionSetRepository questionSetRepository;
    private final SubmissionRepository submissionRepository;

    public AnalyticsService(QuestionSetRepository questionSetRepository, SubmissionRepository submissionRepository) {
        this.questionSetRepository = questionSetRepository;
        this.submissionRepository = submissionRepository;
    }

    @Transactional(readOnly = true)
    public AnalyticsDtos.Dashboard teacherDashboard(
            User teacher,
            Integer semester,
            String section,
            String branch,
            String subject
    ) {
        List<QuestionSet> sets = questionSetRepository.findByTeacherIdOrderByCreatedAtDesc(teacher.getId())
                .stream()
                .filter(set -> semester == null || Objects.equals(set.getSemester(), semester))
                .filter(set -> section == null || section.isBlank() || section.equalsIgnoreCase(set.getSection()))
                .filter(set -> branch == null || branch.isBlank() || branch.equalsIgnoreCase(set.getBranch()))
                .filter(set -> subject == null || subject.isBlank() || subject.equalsIgnoreCase(set.getSubject()))
                .toList();

        Set<UUID> setIds = sets.stream().map(QuestionSet::getId).collect(Collectors.toSet());
        List<Submission> submissions = sets.stream()
                .flatMap(set -> submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(set.getId()).stream())
                .filter(submission -> hasUsableGrade(submission))
                .toList();

        List<StudentMetricInternal> metrics = submissions.stream()
                .map(this::metricFor)
                .toList();

        Map<UUID, List<StudentMetricInternal>> byStudent = metrics.stream()
                .collect(Collectors.groupingBy(StudentMetricInternal::studentId));

        List<AnalyticsDtos.StudentMetric> studentWise = byStudent.values().stream()
                .map(list -> aggregateStudent(list.get(0).studentId(), list))
                .sorted(Comparator.comparingDouble(AnalyticsDtos.StudentMetric::percentage).reversed())
                .toList();

        List<AnalyticsDtos.Bucket> subjectWise = bucketBy(
                metrics,
                metric -> metric.subject() == null || metric.subject().isBlank() ? "Unspecified" : metric.subject()
        );

        List<AnalyticsDtos.Bucket> classWise = bucketBy(
                metrics,
                metric -> "Sem " + metric.semester() + " - Sec " + metric.section() + " - " + metric.branch()
        );

        List<AnalyticsDtos.Bucket> examWise = bucketBy(metrics, StudentMetricInternal::examName);

        double average = metrics.stream().mapToDouble(StudentMetricInternal::percentage).average().orElse(0.0);
        double highest = metrics.stream().mapToDouble(StudentMetricInternal::percentage).max().orElse(0.0);
        double lowest = metrics.stream().mapToDouble(StudentMetricInternal::percentage).min().orElse(0.0);

        int assessmentCount = sets.size();
        int studentCount = studentWise.size();

        return new AnalyticsDtos.Dashboard(
                new AnalyticsDtos.Summary(
                        studentCount,
                        assessmentCount,
                        round(average),
                        round(highest),
                        round(lowest)
                ),
                subjectWise,
                studentWise,
                classWise,
                examWise
        );
    }

    private boolean hasUsableGrade(Submission submission) {
        return submission.getGrades() != null && !submission.getGrades().isEmpty();
    }

    private StudentMetricInternal metricFor(Submission submission) {
        Grade selected = submission.getGrades().stream()
                .filter(grade -> grade.getGraderType() == GraderType.TEACHER)
                .max(Comparator.comparing(Grade::getCreatedAt))
                .orElseGet(() -> submission.getGrades().stream()
                        .filter(grade -> grade.getGraderType() == GraderType.AI)
                        .max(Comparator.comparing(Grade::getCreatedAt))
                        .orElse(null));

        double score = selected == null ? 0.0 : selected.getScore();
        double max = selected == null ? submission.getQuestion().getMaxMarks() : selected.getMaxScore();
        double percentage = max <= 0 ? 0.0 : score * 100.0 / max;
        QuestionSet set = submission.getQuestion().getQuestionSet();

        return new StudentMetricInternal(
                submission.getStudent().getId(),
                submission.getStudent().getFullName(),
                submission.getStudent().getUsn(),
                score,
                max,
                percentage,
                set.getSubject(),
                set.getSemester(),
                set.getSection(),
                set.getBranch(),
                set.getTitle()
        );
    }

    private AnalyticsDtos.StudentMetric aggregateStudent(UUID studentId, List<StudentMetricInternal> list) {
        double score = list.stream().mapToDouble(StudentMetricInternal::score).sum();
        double max = list.stream().mapToDouble(StudentMetricInternal::maxScore).sum();
        double percentage = max <= 0 ? 0.0 : score * 100.0 / max;
        StudentMetricInternal first = list.get(0);
        return new AnalyticsDtos.StudentMetric(
                studentId,
                first.name(),
                first.usn(),
                round(score),
                round(max),
                round(percentage)
        );
    }

    private List<AnalyticsDtos.Bucket> bucketBy(
            List<StudentMetricInternal> metrics,
            Function<StudentMetricInternal, String> keyFunction
    ) {
        Map<String, List<StudentMetricInternal>> grouped = metrics.stream()
                .collect(Collectors.groupingBy(keyFunction, LinkedHashMap::new, Collectors.toList()));

        return grouped.entrySet().stream()
                .map(entry -> {
                    List<StudentMetricInternal> list = entry.getValue();
                    double score = list.stream().mapToDouble(StudentMetricInternal::score).sum();
                    double max = list.stream().mapToDouble(StudentMetricInternal::maxScore).sum();
                    double percentage = max <= 0 ? 0.0 : score * 100.0 / max;
                    return new AnalyticsDtos.Bucket(
                            entry.getKey(),
                            round(percentage),
                            round(list.stream().mapToDouble(StudentMetricInternal::score).average().orElse(0.0)),
                            list.size()
                    );
                })
                .sorted(Comparator.comparingDouble(AnalyticsDtos.Bucket::averagePercentage).reversed())
                .toList();
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record StudentMetricInternal(
            UUID studentId,
            String name,
            String usn,
            double score,
            double maxScore,
            double percentage,
            String subject,
            Integer semester,
            String section,
            String branch,
            String examName
    ) {
    }
}
