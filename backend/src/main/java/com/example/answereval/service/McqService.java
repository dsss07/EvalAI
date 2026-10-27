package com.example.answereval.service;

import com.example.answereval.dto.McqDtos;
import com.example.answereval.dto.QuestionScoreItem;
import com.example.answereval.entity.*;
import com.example.answereval.repository.MCQAnswerRepository;
import com.example.answereval.repository.MCQQuestionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class McqService {

    private final MCQQuestionRepository questionRepository;
    private final MCQAnswerRepository answerRepository;
    private final QuestionSetService questionSetService;
    private final GeminiService geminiService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EmailService emailService;

    public McqService(
            MCQQuestionRepository questionRepository,
            MCQAnswerRepository answerRepository,
            QuestionSetService questionSetService,
            GeminiService geminiService
    ) {
        this.questionRepository = questionRepository;
        this.answerRepository = answerRepository;
        this.questionSetService = questionSetService;
        this.geminiService = geminiService;
    }

    @Transactional
    public List<McqDtos.Response> createMany(UUID setId, List<McqDtos.CreateRequest> requests, User teacher) {
        QuestionSet set = questionSetService.findOwnedSet(setId, teacher);
        List<MCQQuestion> saved = new ArrayList<>();

        for (McqDtos.CreateRequest request : requests) {
            MCQQuestion question = new MCQQuestion();
            question.setQuestionSet(set);
            question.setQuestionText(request.questionText());
            question.setOptions(request.options());
            question.setCorrectOption(request.correctOption());
            question.setMarks(request.marks());
            saved.add(questionRepository.save(question));
        }

        return saved.stream().map(this::toResponse).toList();
    }

    @Transactional
    public List<McqDtos.Response> extractFromPdf(UUID setId, MultipartFile pdf, User teacher) throws IOException {
        QuestionSet set = questionSetService.findOwnedSet(setId, teacher);
        List<GeminiService.McqExtraction> extracted = geminiService.extractMcqs(pdf.getBytes());
        List<McqDtos.Response> result = new ArrayList<>();

        for (GeminiService.McqExtraction item : extracted) {
            MCQQuestion question = new MCQQuestion();
            question.setQuestionSet(set);
            question.setQuestionText(item.questionText());
            question.setOptions(item.options());
            question.setCorrectOption(item.correctOption());
            question.setMarks(item.marks());
            result.add(toResponse(questionRepository.save(question)));
        }

        return result;
    }

    @Transactional(readOnly = true)
    public List<McqDtos.Response> list(UUID setId, User teacher) {
        questionSetService.findOwnedSet(setId, teacher);
        return questionRepository.findByQuestionSetId(setId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public McqDtos.Response update(UUID setId, UUID questionId, McqDtos.CreateRequest request, User teacher) {
        questionSetService.findOwnedSet(setId, teacher);
        MCQQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "MCQ not found"));
        if (!question.getQuestionSet().getId().equals(setId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "MCQ not found");
        }

        question.setQuestionText(request.questionText());
        question.setOptions(request.options());
        question.setCorrectOption(request.correctOption());
        question.setMarks(request.marks());
        return toResponse(question);
    }

    @Transactional
    public void delete(UUID setId, UUID questionId, User teacher) {
        questionSetService.findOwnedSet(setId, teacher);
        questionRepository.deleteById(questionId);
    }

    @Transactional
    public void awardGrace(UUID setId, UUID questionId, double graceMarks, User teacher) {
        questionSetService.findOwnedSet(setId, teacher);
        MCQQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "MCQ not found"));
        question.setGraceAwarded(true);
        question.setMarks(question.getMarks() + graceMarks);
    }

    @Transactional(readOnly = true)
    public McqDtos.StudentTest getStudentTest(UUID setId, User student) {
        QuestionSet set = questionSetService.find(setId);
        if (!matchesStudent(set, student) || set.getStatus() != TestStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Test is not available");
        }

        OffsetDateTime now = OffsetDateTime.now();
        if (set.getStartTime() != null && now.isBefore(set.getStartTime())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Test has not started");
        }
        if (set.getEndTime() != null && now.isAfter(set.getEndTime())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Test window has closed");
        }
        if (answerRepository.existsByQuestionSetIdAndStudentId(setId, student.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You have already submitted this test");
        }

        List<McqDtos.StudentResponse> questions = new ArrayList<>(
                questionRepository.findByQuestionSetId(setId).stream()
                        .map(q -> new McqDtos.StudentResponse(q.getId(), q.getQuestionText(), q.getOptions()))
                        .toList()
        );
        Collections.shuffle(questions, new Random(Objects.hash(student.getId(), setId)));

        return new McqDtos.StudentTest(
                setId,
                set.getTitle(),
                set.getStartTime(),
                set.getEndTime(),
                set.getDurationMinutes(),
                questions
        );
    }

    @Transactional
    public double submit(UUID setId, McqDtos.SubmissionRequest request, User student) {
        QuestionSet set = questionSetService.find(setId);
        if (!matchesStudent(set, student)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        if (answerRepository.existsByQuestionSetIdAndStudentId(setId, student.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Test already submitted");
        }

        Map<UUID, MCQQuestion> questions = new HashMap<>();
        for (MCQQuestion question : questionRepository.findByQuestionSetId(setId)) {
            questions.put(question.getId(), question);
        }

        double total = 0.0;
        for (McqDtos.Answer answer : request.answers()) {
            MCQQuestion question = questions.get(answer.questionId());
            if (question == null) {
                continue;
            }

            boolean correct = answer.selectedOption() != null
                    && answer.selectedOption().trim().equalsIgnoreCase(question.getCorrectOption().trim());
            double marks = correct ? question.getMarks() : 0.0;
            total += marks;

            MCQAnswer entity = new MCQAnswer();
            entity.setQuestionSet(set);
            entity.setStudent(student);
            entity.setQuestion(question);
            entity.setSelectedOption(answer.selectedOption());
            entity.setCorrect(correct);
            entity.setMarksAwarded(marks);
            answerRepository.save(entity);
        }

        return total;
    }

    @Transactional
    public void finalizeTest(UUID setId, User teacher) {
        QuestionSet set = questionSetService.findOwnedSet(setId, teacher);
        set.setStatus(TestStatus.COMPLETED);

        if (emailService != null) {
            List<MCQAnswer> answers = answerRepository.findByQuestionSetId(setId);
            if (!answers.isEmpty()) {
                double maxScore = questionRepository.findByQuestionSetId(setId).stream()
                        .mapToDouble(MCQQuestion::getMarks)
                        .sum();

                Map<User, List<MCQAnswer>> byStudent = answers.stream()
                        .collect(Collectors.groupingBy(MCQAnswer::getStudent));

                for (Map.Entry<User, List<MCQAnswer>> entry : byStudent.entrySet()) {
                    User student = entry.getKey();
                    List<MCQAnswer> studentAnswers = entry.getValue();
                    double totalScore = studentAnswers.stream().mapToDouble(MCQAnswer::getMarksAwarded).sum();

                    int qNum = 1;
                    List<QuestionScoreItem> breakdown = new ArrayList<>();
                    for (MCQAnswer a : studentAnswers) {
                        breakdown.add(new QuestionScoreItem(
                                qNum++,
                                a.getQuestion().getQuestionText(),
                                a.getMarksAwarded(),
                                a.getQuestion().getMarks()
                        ));
                    }

                    emailService.sendResultsPublishedEmail(student, set, totalScore, maxScore, breakdown);
                }
            }
        }
    }

    private boolean matchesStudent(QuestionSet set, User student) {
        return (set.getBranch() == null || set.getBranch().equalsIgnoreCase(student.getBranch()))
                && (set.getSemester() == null || set.getSemester().equals(student.getSemester()))
                && (set.getSection() == null || set.getSection().equalsIgnoreCase(student.getSection()));
    }

    private McqDtos.Response toResponse(MCQQuestion question) {
        return new McqDtos.Response(
                question.getId(),
                question.getQuestionText(),
                question.getOptions(),
                question.getCorrectOption(),
                question.getMarks(),
                question.isGraceAwarded()
        );
    }
}
