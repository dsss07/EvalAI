package com.example.answereval.service;

import com.example.answereval.config.RabbitMQConfig;
import com.example.answereval.dto.EvaluationMessage;
import com.example.answereval.dto.ScriptOcrMessage;
import com.example.answereval.dto.SubmissionDtos;
import com.example.answereval.dto.SubmissionProgressEvent;
import com.example.answereval.entity.*;
import com.example.answereval.exception.DuplicateSubmissionException;
import com.example.answereval.exception.ExamDeadlineExceededException;
import com.example.answereval.exception.ExamNotStartedException;
import com.example.answereval.repository.GradeRepository;
import com.example.answereval.repository.MCQAnswerRepository;
import com.example.answereval.repository.QuestionRepository;
import com.example.answereval.repository.SubmissionRepository;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class SubmissionService {

    private static final Logger log = LoggerFactory.getLogger(SubmissionService.class);

    private final SubmissionRepository submissionRepository;
    private final QuestionRepository questionRepository;
    private final GradeRepository gradeRepository;
    private final GeminiService geminiService;
    private final FileStorageService fileStorageService;
    private final EvaluationService evaluationService;
    private final RabbitTemplate rabbitTemplate;
    private final ProgressBroadcasterService progressBroadcasterService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private MCQAnswerRepository mcqAnswerRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EvaluationReportService evaluationReportService;

    public SubmissionService(
            SubmissionRepository submissionRepository,
            QuestionRepository questionRepository,
            GradeRepository gradeRepository,
            GeminiService geminiService,
            FileStorageService fileStorageService,
            EvaluationService evaluationService,
            RabbitTemplate rabbitTemplate,
            ProgressBroadcasterService progressBroadcasterService
    ) {
        this.submissionRepository = submissionRepository;
        this.questionRepository = questionRepository;
        this.gradeRepository = gradeRepository;
        this.geminiService = geminiService;
        this.fileStorageService = fileStorageService;
        this.evaluationService = evaluationService;
        this.rabbitTemplate = rabbitTemplate;
        this.progressBroadcasterService = progressBroadcasterService;
    }

    @Transactional
    public SubmissionDtos.Response submitText(UUID questionId, String answerText, User student) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found"));
        checkStudentAccess(question, student);
        validateSubmissionWindow(question.getQuestionSet());
        if (submissionRepository.existsByStudentIdAndQuestionId(student.getId(), questionId)) {
            throw new DuplicateSubmissionException("You have already submitted an answer for this question");
        }

        Submission submission = new Submission();
        submission.setQuestion(question);
        submission.setStudent(student);
        submission.setAnswerText(answerText == null ? "" : answerText.trim());
        submission.setNeedsReview(false);
        submission.setGradingStatus("PENDING");
        Submission saved;
        try {
            saved = submissionRepository.saveAndFlush(submission);
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateSubmissionException("You have already submitted an answer for this question", ex);
        }

        scheduleEvaluation(saved.getId());
        return toResponse(saved, true);
    }

    @Transactional
    public SubmissionDtos.Response submitScanned(UUID questionId, MultipartFile file, User student) throws IOException {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found"));
        checkStudentAccess(question, student);
        validateSubmissionWindow(question.getQuestionSet());
        if (submissionRepository.existsByStudentIdAndQuestionId(student.getId(), questionId)) {
            throw new DuplicateSubmissionException("You have already submitted an answer for this question");
        }

        FileStorageService.StoredFile stored = fileStorageService.store(file);
        String extractedText = extractSingleAnswer(file);

        Submission submission = new Submission();
        submission.setQuestion(question);
        submission.setStudent(student);
        submission.setAnswerText(extractedText);
        submission.setImageUrl("/uploads/" + stored.filename());
        submission.setNeedsReview(extractedText.isBlank());
        submission.setGradingStatus(extractedText.isBlank() ? "NEEDS_REVIEW" : "PENDING");
        Submission saved;
        try {
            saved = submissionRepository.saveAndFlush(submission);
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateSubmissionException("You have already submitted an answer for this question", ex);
        }

        if (!saved.isNeedsReview()) {
            scheduleEvaluation(saved.getId());
        }

        return toResponse(saved, true);
    }

    @Transactional
    public List<SubmissionDtos.Response> submitFullScript(
            UUID setId,
            List<MultipartFile> files,
            User student
    ) throws IOException {
        log.info("Full-script submission received: setId={}, studentId={}, role={}, files={}",
                setId, student.getId(), student.getRole(), files == null ? 0 : files.size());
        List<Question> questions = questionRepository.findByQuestionSetIdOrderByQuestionOrderAsc(setId);
        if (questions.isEmpty()) {
            log.warn("Full-script submission rejected: no questions found for setId={}", setId);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No questions found");
        }

        QuestionSet questionSet = questions.get(0).getQuestionSet();
        if (!isEligible(questionSet, student)) {
            log.warn("Full-script submission rejected by eligibility: setId={}, studentId={}, studentBranch={}, studentSemester={}, studentSection={}, setBranch={}, setSemester={}, setSection={}, explicitEligibleCount={}",
                    setId, student.getId(), student.getBranch(), student.getSemester(), student.getSection(),
                    questionSet.getBranch(), questionSet.getSemester(), questionSet.getSection(),
                    questionSet.getEligibleStudents() == null ? 0 : questionSet.getEligibleStudents().size());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not eligible for this assessment. Ask your teacher to verify your semester, branch, section, and eligible-student list.");
        }
        validateSubmissionWindow(questionSet);
        if (submissionRepository.existsByStudentIdAndQuestionQuestionSetId(student.getId(), setId)) {
            log.warn("Full-script submission rejected as duplicate: setId={}, studentId={}", setId, student.getId());
            throw new DuplicateSubmissionException("You have already submitted this assessment");
        }

        List<FileStorageService.StoredFile> storedFiles = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                storedFiles.add(fileStorageService.store(file));
            }
        }

        if (storedFiles.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No valid files supplied");
        }

        String imageUrl = "/uploads/" + storedFiles.get(0).filename();
        List<SubmissionDtos.Response> responses = new ArrayList<>();

        for (Question question : questions) {
            Submission submission = new Submission();
            submission.setQuestion(question);
            submission.setStudent(student);
            submission.setAnswerText("[Queued for OCR Processing]");
            submission.setImageUrl(imageUrl);
            submission.setNeedsReview(false);
            submission.setGradingStatus("QUEUED");
            try {
                Submission saved = submissionRepository.saveAndFlush(submission);
                responses.add(toResponse(saved, true));
            } catch (DataIntegrityViolationException ex) {
                throw new DuplicateSubmissionException("You have already submitted this assessment", ex);
            }
        }

        List<String> fileKeys = storedFiles.stream().map(FileStorageService.StoredFile::filename).toList();
        ScriptOcrMessage message = new ScriptOcrMessage(
                student.getId(),
                setId,
                fileKeys,
                OffsetDateTime.now()
        );

        SubmissionProgressEvent queuedEvent = SubmissionProgressEvent.of(
                null,
                setId,
                "QUEUED",
                10,
                "Submission received and queued for OCR processing."
        );

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    rabbitTemplate.convertAndSend(
                            RabbitMQConfig.EVAL_EXCHANGE,
                            RabbitMQConfig.SUBMISSION_OCR_KEY,
                            message
                    );
                    log.info("Dispatched ScriptOcrMessage for studentId={}, setId={}", student.getId(), setId);
                    progressBroadcasterService.broadcast(student.getEmail(), setId, queuedEvent);
                }
            });
        } else {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EVAL_EXCHANGE,
                    RabbitMQConfig.SUBMISSION_OCR_KEY,
                    message
            );
            log.info("Dispatched ScriptOcrMessage for studentId={}, setId={}", student.getId(), setId);
            progressBroadcasterService.broadcast(student.getEmail(), setId, queuedEvent);
        }

        return responses;
    }

    @Transactional(readOnly = true)
    public List<UUID> submittedQuestionSetIds(User student) {
        if (student.getRole() != UserRole.STUDENT) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student account required");
        }
        Set<UUID> ids = new HashSet<>(submissionRepository.findByStudentIdOrderBySubmittedAtDesc(student.getId()).stream()
                .map(submission -> submission.getQuestion().getQuestionSet().getId())
                .toList());
        if (mcqAnswerRepository != null) {
            ids.addAll(mcqAnswerRepository.findByStudentId(student.getId()).stream()
                    .map(a -> a.getQuestionSet().getId())
                    .toList());
        }
        return new ArrayList<>(ids);
    }

    @Transactional(readOnly = true)
    public List<SubmissionDtos.DetailResponse> list(UUID setId, User user) {
        List<Submission> submissions = setId == null
                ? submissionRepository.findByStudentIdOrderBySubmittedAtDesc(user.getId())
                : submissionRepository.findByQuestionQuestionSetIdOrderBySubmittedAtDesc(setId);

        if (user.getRole() == UserRole.STUDENT) {
            submissions = submissions.stream()
                    .filter(submission -> submission.getStudent().getId().equals(user.getId()))
                    .toList();
        } else if (setId != null) {
            UUID teacherId = submissions.isEmpty() ? null : submissions.get(0).getQuestion().getQuestionSet().getTeacher().getId();
            if (teacherId != null && !teacherId.equals(user.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
            }
        }

        return submissions.stream().map(submission -> toDetail(submission, user)).toList();
    }

    @Transactional(readOnly = true)
    public SubmissionDtos.DetailResponse get(UUID submissionId, User user) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submission not found"));
        authorizeSubmission(submission, user);
        return toDetail(submission, user);
    }

    @Transactional
    public SubmissionDtos.GradeResponse teacherGrade(UUID submissionId, SubmissionDtos.TeacherGradeRequest request, User teacher) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submission not found"));
        authorizeTeacher(submission, teacher);

        if (request.score() < 0 || request.score() > submission.getQuestion().getMaxMarks()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Score is outside the allowed range");
        }

        Grade grade = gradeRepository.findBySubmissionIdOrderByCreatedAtDesc(submissionId).stream()
                .filter(g -> g.getGraderType() == GraderType.TEACHER)
                .findFirst()
                .orElseGet(() -> {
                    Grade g = new Grade();
                    g.setSubmission(submission);
                    g.setGraderType(GraderType.TEACHER);
                    return g;
                });

        grade.setGrader(teacher);
        double snappedScore = Math.max(0.0, Math.min(submission.getQuestion().getMaxMarks(), Math.round(request.score() * 2.0) / 2.0));
        grade.setScore(snappedScore);
        grade.setMaxScore(submission.getQuestion().getMaxMarks());
        grade.setBreakdown(Map.of("remarks", request.remarks() == null ? "" : request.remarks()));
        grade.setCreatedAt(OffsetDateTime.now());
        Grade saved = gradeRepository.save(grade);

        submission.setFinalSubmission(true);
        submission.setGradingStatus("TEACHER_REVIEWED");
        Submission savedSubmission = submissionRepository.save(submission);
        if (evaluationReportService != null) {
            evaluationReportService.autoResolveForSubmission(savedSubmission);
        }

        return toGradeResponse(saved);
    }

    @Transactional
    public SubmissionDtos.Response confirmOcr(UUID submissionId, SubmissionDtos.ConfirmOcrRequest request, User teacher) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submission not found"));
        authorizeTeacher(submission, teacher);
        submission.setAnswerText(request.correctedText());
        submission.setNeedsReview(false);
        submission.setGradingStatus("PENDING");
        Submission saved = submissionRepository.save(submission);
        scheduleEvaluation(saved.getId());
        return toResponse(saved, true);
    }

    @Transactional
    public List<SubmissionDtos.Response> confirmScript(SubmissionDtos.ConfirmScriptRequest request, User teacher) {
        if (request.segments() == null || request.segments().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No script segments supplied");
        }

        List<Submission> targets = new ArrayList<>();
        Set<String> assignedStudentQuestionPairs = new HashSet<>();

        // Validate the complete request before mutating any submissions.
        for (SubmissionDtos.ScriptSegment segment : request.segments()) {
            Submission submission = submissionRepository.findById(segment.submissionId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submission not found"));
            authorizeTeacher(submission, teacher);

            if (segment.questionId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A question must be assigned to every segment");
            }
            Question targetQuestion = questionRepository.findById(segment.questionId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned question not found"));
            UUID sourceSetId = submission.getQuestion().getQuestionSet().getId();
            UUID targetSetId = targetQuestion.getQuestionSet().getId();
            if (!sourceSetId.equals(targetSetId)
                    || !targetQuestion.getQuestionSet().getTeacher().getId().equals(teacher.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned question must belong to this teacher's question set");
            }

            String pair = submission.getStudent().getId() + ":" + targetQuestion.getId();
            if (!assignedStudentQuestionPairs.add(pair)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each student can have only one segment assigned to a question");
            }
            submission.setQuestion(targetQuestion);
            submission.setAnswerText(segment.correctedText() == null ? "" : segment.correctedText().trim());
            submission.setNeedsReview(false);
            submission.setGradingStatus("PENDING");
            targets.add(submission);
        }

        List<SubmissionDtos.Response> responses = new ArrayList<>();
        for (Submission submission : targets) {
            Submission saved = submissionRepository.save(submission);
            responses.add(toResponse(saved, true));
            scheduleEvaluation(saved.getId());
        }
        return responses;
    }

    @Transactional
    public SubmissionDtos.Response finalizeSubmission(UUID submissionId, User teacher) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submission not found"));
        authorizeTeacher(submission, teacher);
        submission.setFinalSubmission(true);
        submission.setGradingStatus("FINAL");
        Submission saved = submissionRepository.save(submission);
        if (evaluationReportService != null) {
            evaluationReportService.autoResolveForSubmission(saved);
        }
        return toResponse(saved, true);
    }

    private void scheduleEvaluation(UUID submissionId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatchScoringMessage(submissionId);
                }
            });
        } else {
            dispatchScoringMessage(submissionId);
        }
    }

    private void dispatchScoringMessage(UUID submissionId) {
        submissionRepository.findById(submissionId).ifPresent(sub -> {
            EvaluationMessage message = new EvaluationMessage(
                    sub.getId(),
                    sub.getQuestion().getId(),
                    sub.getAnswerText()
            );
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EVAL_EXCHANGE,
                    RabbitMQConfig.SUBMISSION_SCORING_KEY,
                    message
            );
            log.info("Dispatched EvaluationMessage for submissionId={}", sub.getId());

            UUID setId = sub.getQuestion().getQuestionSet() != null ? sub.getQuestion().getQuestionSet().getId() : null;
            SubmissionProgressEvent queuedEvent = SubmissionProgressEvent.of(
                    sub.getId(),
                    setId,
                    "QUEUED",
                    10,
                    "Answer submitted and queued for evaluation."
            );
            progressBroadcasterService.broadcast(sub.getStudent().getEmail(), setId, queuedEvent);
        });
    }

    private String extractSingleAnswer(MultipartFile file) {
        try {
            return geminiService.parseFullScript(
                    List.of(new GeminiService.MediaInput(
                            file.getBytes(),
                            file.getContentType() == null ? "image/png" : file.getContentType()
                    )),
                    List.of(new GeminiService.QuestionContext("single", 1, "Read the student's answer on this page."))
            ).values().stream()
                    .findFirst()
                    .map(item -> String.valueOf(item.getOrDefault("text", "")))
                    .orElse("");
        } catch (IOException exception) {
            return "";
        }
    }

    public void validateSubmissionWindow(QuestionSet exam) {
        Instant now = Instant.now();
        if (exam.getStartTime() != null) {
            Instant startInstant = exam.getStartTime().toInstant();
            if (now.isBefore(startInstant)) {
                throw new ExamNotStartedException(
                        "Assessment has not started yet. Starts at: " + exam.getStartTime()
                );
            }
        }
        if (exam.getEndTime() != null) {
            int graceMinutes = exam.getGracePeriodMinutes() != null ? exam.getGracePeriodMinutes() : 5;
            Instant deadlineWithGrace = exam.getEndTime().toInstant().plus(Duration.ofMinutes(graceMinutes));
            if (now.isAfter(deadlineWithGrace)) {
                throw new ExamDeadlineExceededException(
                        "Assessment deadline (including " + graceMinutes + " min grace period) has passed."
                );
            }
        }
    }

    private void checkStudentAccess(Question question, User student) {
        QuestionSet set = question.getQuestionSet();
        if (!isEligible(set, student)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not eligible for this assessment");
        }
    }

    private boolean isEligible(QuestionSet set, User student) {
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

    private void authorizeSubmission(Submission submission, User user) {
        if (user.getRole() == UserRole.STUDENT) {
            if (!submission.getStudent().getId().equals(user.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
            }
        } else {
            authorizeTeacher(submission, user);
        }
    }

    private void authorizeTeacher(Submission submission, User teacher) {
        if (submission.getQuestion().getQuestionSet().getTeacher().getId() == null
                || !submission.getQuestion().getQuestionSet().getTeacher().getId().equals(teacher.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    private SubmissionDtos.DetailResponse toDetail(Submission submission, User viewer) {
        SubmissionDtos.Response response = toResponse(submission, viewer.getRole() == UserRole.TEACHER);
        return new SubmissionDtos.DetailResponse(
                response,
                submission.getStudent().getFullName(),
                submission.getStudent().getUsn(),
                submission.getStudent().getBranch(),
                submission.getQuestion().getQuestionText()
        );
    }

    private SubmissionDtos.Response toResponse(Submission submission, boolean includeGrades) {
        List<SubmissionDtos.GradeResponse> grades = includeGrades
                ? submission.getGrades().stream().map(this::toGradeResponse).toList()
                : List.of();

        return new SubmissionDtos.Response(
                submission.getId(),
                submission.getQuestion().getId(),
                submission.getStudent().getId(),
                submission.getAnswerText(),
                submission.getSubmittedAt(),
                submission.isNeedsReview(),
                submission.getImageUrl(),
                submission.isFinalSubmission(),
                submission.getGradingStatus(),
                grades
        );
    }

    private SubmissionDtos.GradeResponse toGradeResponse(Grade grade) {
        return new SubmissionDtos.GradeResponse(
                grade.getId(),
                grade.getGraderType(),
                grade.getGrader() == null ? null : grade.getGrader().getId(),
                grade.getScore(),
                grade.getMaxScore(),
                grade.getMode(),
                grade.getBreakdown(),
                grade.getCreatedAt()
        );
    }
}
