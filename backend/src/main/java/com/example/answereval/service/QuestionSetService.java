package com.example.answereval.service;

import com.example.answereval.dto.AssessmentState;
import com.example.answereval.dto.QuestionScoreItem;
import com.example.answereval.dto.QuestionSetDtos;
import com.example.answereval.dto.StudentAssessmentStatusDto;
import com.example.answereval.entity.*;
import com.example.answereval.repository.MCQAnswerRepository;
import com.example.answereval.repository.MCQQuestionRepository;
import com.example.answereval.repository.QuestionRepository;
import com.example.answereval.repository.QuestionSetRepository;
import com.example.answereval.repository.SubmissionRepository;
import com.example.answereval.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class QuestionSetService {

    private final QuestionSetRepository questionSetRepository;
    private final QuestionRepository questionRepository;
    private final MCQQuestionRepository mcqQuestionRepository;
    private final SubmissionRepository submissionRepository;
    private final UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private MCQAnswerRepository mcqAnswerRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EmailService emailService;

    public QuestionSetService(
            QuestionSetRepository questionSetRepository,
            QuestionRepository questionRepository,
            MCQQuestionRepository mcqQuestionRepository,
            SubmissionRepository submissionRepository,
            UserRepository userRepository
    ) {
        this.questionSetRepository = questionSetRepository;
        this.questionRepository = questionRepository;
        this.mcqQuestionRepository = mcqQuestionRepository;
        this.submissionRepository = submissionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public QuestionSetDtos.Response create(QuestionSetDtos.CreateRequest request, User teacher) {
        QuestionSet set = new QuestionSet();
        set.setTitle(request.title());
        set.setDescription(request.description() == null ? "" : request.description());
        set.setSemester(request.semester());
        set.setSection(request.section());
        set.setBranch(request.branch());
        set.setSubject(request.subject());
        set.setGradingMode(request.gradingMode() == null ? GradingMode.MID : request.gradingMode());
        set.setTestType(request.testType() == null ? TestType.DESCRIPTIVE : request.testType());
        set.setTeacher(teacher);
        set.setStatus(TestStatus.ACTIVE);
        if (request.startTime() != null && request.endTime() != null && request.endTime().isBefore(request.startTime())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End time must be after start time");
        }
        set.setStartTime(request.startTime());
        set.setEndTime(request.endTime());
        if (request.durationMinutes() != null) {
            set.setDurationMinutes(request.durationMinutes());
        } else if (request.startTime() != null && request.endTime() != null) {
            long minutes = java.time.Duration.between(request.startTime(), request.endTime()).toMinutes();
            if (minutes > 0) {
                set.setDurationMinutes((int) minutes);
            }
        }
        set.setGracePeriodMinutes(request.gracePeriodMinutes() == null ? 5 : request.gracePeriodMinutes());
        if (request.eligibleStudentIds() != null && !request.eligibleStudentIds().isEmpty()) {
            List<User> eligible = userRepository.findAllById(request.eligibleStudentIds());
            if (eligible.size() != new HashSet<>(request.eligibleStudentIds()).size()
                    || eligible.stream().anyMatch(u -> u.getRole() != UserRole.STUDENT
                    || !matchesStudent(set, u))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Eligible students must be existing students matching the selected semester, branch and section");
            }
            set.setEligibleStudents(eligible);
        }
        return toResponse(questionSetRepository.save(set));
    }

    @Transactional(readOnly = true)
    public List<QuestionSetDtos.Response> list(User user) {
        List<QuestionSet> sets;
        if (user.getRole() == UserRole.TEACHER) {
            sets = questionSetRepository.findByTeacherIdOrderByCreatedAtDesc(user.getId());
        } else {
            sets = questionSetRepository.findAll().stream()
                    .filter(set -> isEligible(set, user))
                    .sorted(Comparator.comparing(QuestionSet::getCreatedAt).reversed())
                    .toList();
        }
        return sets.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public QuestionSetDtos.DetailResponse get(UUID id, User user) {
        QuestionSet set = find(id);
        if (user.getRole() == UserRole.STUDENT && !isEligible(set, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        List<Question> rawQuestions = questionRepository
                .findByQuestionSetIdOrderByQuestionOrderAsc(id);
        boolean reorderNeeded = false;
        for (int i = 0; i < rawQuestions.size(); i++) {
            if (rawQuestions.get(i).getQuestionOrder() == null || rawQuestions.get(i).getQuestionOrder() <= 0) {
                reorderNeeded = true;
                break;
            }
        }
        if (reorderNeeded) {
            for (int i = 0; i < rawQuestions.size(); i++) {
                rawQuestions.get(i).setQuestionOrder(i + 1);
                questionRepository.save(rawQuestions.get(i));
            }
        }
        List<QuestionSetDtos.QuestionResponse> questions = rawQuestions
                .stream()
                .map(this::toQuestionResponse)
                .toList();

        if (questions.isEmpty() && set.getTestType() == TestType.MCQ) {
            List<MCQQuestion> mcqs = mcqQuestionRepository.findByQuestionSetId(id);
            int order = 1;
            List<QuestionSetDtos.QuestionResponse> mapped = new ArrayList<>();
            for (MCQQuestion q : mcqs) {
                String key = (user.getRole() == UserRole.TEACHER || set.getStatus() == TestStatus.COMPLETED)
                        ? q.getCorrectOption() : null;
                mapped.add(new QuestionSetDtos.QuestionResponse(
                        q.getId(),
                        set.getId(),
                        q.getQuestionText(),
                        key,
                        (int) Math.round(q.getMarks()),
                        order++,
                        q.getOptions()
                ));
            }
            questions = mapped;
        }

        return new QuestionSetDtos.DetailResponse(
                toResponse(set),
                set.getTeacher().getFullName(),
                questions
        );
    }

    @Transactional
    public QuestionSetDtos.QuestionResponse addQuestion(UUID setId, QuestionSetDtos.CreateQuestionRequest request, User teacher) {
        QuestionSet set = findOwnedSet(setId, teacher);
        Question question = new Question();
        question.setQuestionSet(set);
        question.setQuestionText(request.questionText());
        question.setAnswerKey(request.answerKey());
        question.setMaxMarks(request.maxMarks() == null ? 10 : request.maxMarks());
        int order = (request.order() == null || request.order() <= 0)
                ? (set.getQuestions() == null ? 1 : set.getQuestions().size() + 1)
                : request.order();
        question.setQuestionOrder(order);
        question.setRubric(request.rubric());
        return toQuestionResponse(questionRepository.save(question));
    }

    @Transactional
    public QuestionSetDtos.QuestionResponse updateQuestion(UUID questionId, QuestionSetDtos.UpdateQuestionRequest request, User teacher) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found"));
        findOwnedSet(question.getQuestionSet().getId(), teacher);

        if (request.questionText() != null) question.setQuestionText(request.questionText());
        if (request.answerKey() != null) question.setAnswerKey(request.answerKey());
        if (request.maxMarks() != null) question.setMaxMarks(request.maxMarks());
        if (request.order() != null) question.setQuestionOrder(request.order() <= 0 ? 1 : request.order());
        if (request.rubric() != null) question.setRubric(request.rubric());
        return toQuestionResponse(question);
    }

    @Transactional
    public void delete(UUID setId, User teacher) {
        QuestionSet set = findOwnedSet(setId, teacher);
        questionSetRepository.delete(set);
    }

    @Transactional
    public void publish(UUID setId, QuestionSetDtos.PublishRequest request, User teacher) {
        QuestionSet set = findOwnedSet(setId, teacher);
        set.setStartTime(request.startTime());
        set.setEndTime(request.endTime());
        set.setDurationMinutes(request.durationMinutes());
        if (request.gracePeriodMinutes() != null) {
            set.setGracePeriodMinutes(request.gracePeriodMinutes());
        }
        set.setStatus(TestStatus.ACTIVE);
    }

    @Transactional
    public void finalizeAll(UUID setId, User teacher) {
        QuestionSet set = findOwnedSet(setId, teacher);
        List<Submission> allSubs = submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(setId);
        allSubs.forEach(submission -> submission.setFinalSubmission(true));
        set.setStatus(TestStatus.COMPLETED);

        if (emailService != null && !allSubs.isEmpty()) {
            Map<User, List<Submission>> byStudent = allSubs.stream()
                    .collect(Collectors.groupingBy(Submission::getStudent));

            double maxScore = set.getQuestions() != null
                    ? set.getQuestions().stream().mapToDouble(Question::getMaxMarks).sum()
                    : 0.0;

            for (Map.Entry<User, List<Submission>> entry : byStudent.entrySet()) {
                User student = entry.getKey();
                List<Submission> studentSubs = entry.getValue();

                Map<UUID, Submission> subMap = studentSubs.stream()
                        .collect(Collectors.toMap(s -> s.getQuestion().getId(), s -> s, (s1, s2) -> s1));

                double totalScore = 0.0;
                List<QuestionScoreItem> breakdown = new ArrayList<>();
                List<Question> sortedQuestions = set.getQuestions() != null
                        ? set.getQuestions().stream()
                            .sorted(Comparator.comparing(Question::getQuestionOrder, Comparator.nullsLast(Comparator.naturalOrder())))
                            .toList()
                        : List.of();

                for (int i = 0; i < sortedQuestions.size(); i++) {
                    Question q = sortedQuestions.get(i);
                    Submission sub = subMap.get(q.getId());
                    double score = sub != null ? calculateFinalScore(sub) : 0.0;
                    totalScore += score;
                    int order = q.getQuestionOrder() != null && q.getQuestionOrder() > 0 ? q.getQuestionOrder() : (i + 1);
                    breakdown.add(new QuestionScoreItem(order, q.getQuestionText(), score, q.getMaxMarks()));
                }

                emailService.sendResultsPublishedEmail(student, set, totalScore, maxScore, breakdown);
            }
        }
    }

    private double calculateFinalScore(Submission submission) {
        if (submission.getGrades() == null || submission.getGrades().isEmpty()) return 0.0;
        return submission.getGrades().stream()
                .filter(grade -> grade.getGraderType() == GraderType.TEACHER)
                .max(Comparator.comparing(Grade::getCreatedAt))
                .or(() -> submission.getGrades().stream()
                        .filter(grade -> grade.getGraderType() == GraderType.AI)
                        .max(Comparator.comparing(Grade::getCreatedAt)))
                .map(Grade::getScore)
                .orElse(0.0);
    }

    public QuestionSet find(UUID id) {
        return questionSetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question set not found"));
    }

    public QuestionSet findOwnedSet(UUID id, User teacher) {
        QuestionSet set = find(id);
        if (!set.getTeacher().getId().equals(teacher.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Question set not found");
        }
        return set;
    }

    public boolean isEligible(QuestionSet set, User student) {
        if (set.getEligibleStudents() != null && !set.getEligibleStudents().isEmpty()) {
            return set.getEligibleStudents().stream().anyMatch(u -> u.getId().equals(student.getId()));
        }
        return matchesStudent(set, student);
    }

    private boolean matchesStudent(QuestionSet set, User student) {
        return (set.getBranch() == null || set.getBranch().equalsIgnoreCase(student.getBranch()))
                && (set.getSemester() == null || set.getSemester().equals(student.getSemester()))
                && (set.getSection() == null || set.getSection().equalsIgnoreCase(student.getSection()));
    }

    public QuestionSetDtos.Response toResponse(QuestionSet set) {
        return new QuestionSetDtos.Response(
                set.getId(),
                set.getTitle(),
                set.getDescription(),
                set.getSemester(),
                set.getSection(),
                set.getBranch(),
                set.getSubject(),
                set.getGradingMode(),
                set.getTeacher().getId(),
                set.getTestType(),
                set.getStatus(),
                set.getStartTime(),
                set.getEndTime(),
                set.getDurationMinutes(),
                set.getGracePeriodMinutes(),
                set.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public StudentAssessmentStatusDto getStudentAssessmentStatus(UUID setId, User student) {
        QuestionSet set = find(setId);
        if (!isEligible(set, student)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        boolean submitted;
        OffsetDateTime submittedAt = null;
        List<String> fileUrls = List.of();
        String gradingStatus = null;

        if (set.getTestType() == TestType.MCQ && mcqAnswerRepository != null) {
            submitted = mcqAnswerRepository.existsByQuestionSetIdAndStudentId(setId, student.getId());
            if (submitted) {
                List<MCQAnswer> mcqAnswers = mcqAnswerRepository.findByQuestionSetIdAndStudentId(setId, student.getId());
                if (!mcqAnswers.isEmpty()) {
                    submittedAt = mcqAnswers.get(0).getSubmittedAt();
                }
                gradingStatus = set.getStatus() == TestStatus.COMPLETED ? "FINAL" : "GRADED";
            }
        } else {
            List<Submission> submissions = submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(setId)
                    .stream()
                    .filter(s -> s.getStudent().getId().equals(student.getId()))
                    .toList();

            submitted = !submissions.isEmpty();
            submittedAt = submitted ? submissions.get(0).getSubmittedAt() : null;

            fileUrls = submissions.stream()
                    .map(Submission::getImageUrl)
                    .filter(url -> url != null && !url.isBlank())
                    .distinct()
                    .toList();

            if (submitted) {
                boolean anyQueued = submissions.stream().anyMatch(s -> "QUEUED".equalsIgnoreCase(s.getGradingStatus()));
                boolean anyScoringQueued = submissions.stream().anyMatch(s -> "SCORING_QUEUED".equalsIgnoreCase(s.getGradingStatus()));
                boolean anyPending = submissions.stream().anyMatch(s -> "PENDING".equalsIgnoreCase(s.getGradingStatus()));
                boolean anyProcessing = submissions.stream().anyMatch(s -> "PROCESSING".equalsIgnoreCase(s.getGradingStatus()));
                boolean anyNeedsReview = submissions.stream().anyMatch(s -> "NEEDS_REVIEW".equalsIgnoreCase(s.getGradingStatus()));
                boolean allFinal = submissions.stream().allMatch(Submission::isFinalSubmission);
                boolean allGraded = submissions.stream().allMatch(s -> "GRADED".equalsIgnoreCase(s.getGradingStatus()) || s.isFinalSubmission());

                if (allFinal) {
                    gradingStatus = "FINAL";
                } else if (anyNeedsReview) {
                    gradingStatus = "NEEDS_REVIEW";
                } else if (anyQueued) {
                    gradingStatus = "QUEUED";
                } else if (anyScoringQueued) {
                    gradingStatus = "SCORING_QUEUED";
                } else if (anyProcessing) {
                    gradingStatus = "PROCESSING";
                } else if (anyPending) {
                    gradingStatus = "PENDING";
                } else if (allGraded) {
                    gradingStatus = "GRADED";
                } else {
                    gradingStatus = submissions.get(0).getGradingStatus();
                }
            }
        }

        OffsetDateTime now = OffsetDateTime.now();
        Instant nowInstant = now.toInstant();
        int graceMinutes = set.getGracePeriodMinutes() != null ? set.getGracePeriodMinutes() : 5;

        AssessmentState state;
        if (submitted) {
            state = AssessmentState.SUBMITTED;
        } else if (set.getStartTime() != null && nowInstant.isBefore(set.getStartTime().toInstant())) {
            state = AssessmentState.UPCOMING;
        } else if (set.getEndTime() != null) {
            Instant deadlineWithGrace = set.getEndTime().toInstant().plus(Duration.ofMinutes(graceMinutes));
            if (nowInstant.isAfter(deadlineWithGrace)) {
                state = AssessmentState.CLOSED;
            } else {
                state = AssessmentState.OPEN;
            }
        } else if (set.getStatus() == TestStatus.COMPLETED) {
            state = AssessmentState.CLOSED;
        } else {
            state = AssessmentState.OPEN;
        }

        return new StudentAssessmentStatusDto(
                set.getId(),
                state,
                set.getStartTime(),
                set.getEndTime(),
                now,
                graceMinutes,
                submitted,
                submittedAt,
                gradingStatus,
                fileUrls
        );
    }

    public QuestionSetDtos.QuestionResponse toQuestionResponse(Question question) {
        int order = (question.getQuestionOrder() != null && question.getQuestionOrder() > 0)
                ? question.getQuestionOrder()
                : 1;
        return new QuestionSetDtos.QuestionResponse(
                question.getId(),
                question.getQuestionSet().getId(),
                question.getQuestionText(),
                question.getAnswerKey(),
                question.getMaxMarks(),
                order,
                null,
                question.getRubric()
        );
    }
}
