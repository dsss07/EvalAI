package com.example.answereval.listener;

import com.example.answereval.config.RabbitMQConfig;
import com.example.answereval.dto.EvaluationMessage;
import com.example.answereval.dto.ScriptOcrMessage;
import com.example.answereval.dto.SubmissionProgressEvent;
import com.example.answereval.entity.Question;
import com.example.answereval.entity.Submission;
import com.example.answereval.entity.User;
import com.example.answereval.repository.QuestionRepository;
import com.example.answereval.repository.SubmissionRepository;
import com.example.answereval.repository.UserRepository;
import com.example.answereval.service.FileStorageService;
import com.example.answereval.service.GeminiService;
import com.example.answereval.service.ProgressBroadcasterService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class SubmissionOcrListener {

    private static final Logger log = LoggerFactory.getLogger(SubmissionOcrListener.class);

    private final FileStorageService fileStorageService;
    private final GeminiService geminiService;
    private final QuestionRepository questionRepository;
    private final SubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final RabbitTemplate rabbitTemplate;
    private final ProgressBroadcasterService progressBroadcasterService;

    public SubmissionOcrListener(
            FileStorageService fileStorageService,
            GeminiService geminiService,
            QuestionRepository questionRepository,
            SubmissionRepository submissionRepository,
            UserRepository userRepository,
            RabbitTemplate rabbitTemplate,
            ProgressBroadcasterService progressBroadcasterService
    ) {
        this.fileStorageService = fileStorageService;
        this.geminiService = geminiService;
        this.questionRepository = questionRepository;
        this.submissionRepository = submissionRepository;
        this.userRepository = userRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.progressBroadcasterService = progressBroadcasterService;
    }

    @RabbitListener(queues = RabbitMQConfig.SUBMISSION_OCR_QUEUE)
    @Transactional
    public void onScriptOcrMessage(ScriptOcrMessage message) throws IOException {
        log.info("Received ScriptOcrMessage: studentId={}, questionSetId={}, files={}",
                message.studentId(), message.questionSetId(), message.filePaths() == null ? 0 : message.filePaths().size());

        String studentEmail = userRepository.findById(message.studentId())
                .map(User::getEmail)
                .orElse(null);

        progressBroadcasterService.broadcast(
                studentEmail,
                message.questionSetId(),
                SubmissionProgressEvent.of(
                        null,
                        message.questionSetId(),
                        "OCR_IN_PROGRESS",
                        30,
                        "AI Vision OCR model is analyzing and segmenting your answer script."
                )
        );

        try {
            List<Question> questions = questionRepository.findByQuestionSetIdOrderByQuestionOrderAsc(message.questionSetId());
            if (questions.isEmpty()) {
                log.warn("No questions found for questionSetId={}; skipping OCR", message.questionSetId());
                return;
            }

            List<GeminiService.MediaInput> mediaInputs = new ArrayList<>();
            if (message.filePaths() != null) {
                for (String fileKey : message.filePaths()) {
                    byte[] data = fileStorageService.loadBytes(fileKey);
                    String contentType = fileStorageService.detectContentType(fileKey);
                    mediaInputs.add(new GeminiService.MediaInput(data, contentType));
                }
            }

            if (mediaInputs.isEmpty()) {
                log.error("No valid file inputs loaded for questionSetId={}, studentId={}",
                        message.questionSetId(), message.studentId());
                throw new IllegalArgumentException("No file inputs available for OCR");
            }

            // Self-heal question orders if any are 0 or negative
            boolean reorderNeeded = false;
            for (int i = 0; i < questions.size(); i++) {
                if (questions.get(i).getQuestionOrder() == null || questions.get(i).getQuestionOrder() <= 0) {
                    reorderNeeded = true;
                    break;
                }
            }
            if (reorderNeeded) {
                for (int i = 0; i < questions.size(); i++) {
                    questions.get(i).setQuestionOrder(i + 1);
                    questionRepository.save(questions.get(i));
                }
            }

            List<GeminiService.QuestionContext> context = questions.stream()
                    .map(q -> new GeminiService.QuestionContext(
                            q.getId().toString(),
                            q.getQuestionOrder() != null && q.getQuestionOrder() > 0 ? q.getQuestionOrder() : 1,
                            q.getQuestionText()
                    ))
                    .toList();

            log.info("Invoking Gemini parseFullScript for studentId={}, questionSetId={}",
                    message.studentId(), message.questionSetId());
            Map<String, Map<String, Object>> parsed = geminiService.parseFullScript(mediaInputs, context);
            log.info("Gemini parsed {} question mappings for studentId={}, questionSetId={}",
                    parsed.size(), message.studentId(), message.questionSetId());

            for (Question question : questions) {
                Map<String, Object> segment = parsed.get(question.getId().toString());
                boolean attempted = segment != null && Boolean.TRUE.equals(segment.get("attempted"));
                String text = segment == null ? "" : String.valueOf(segment.getOrDefault("text", ""));

                Submission submission = submissionRepository.findByStudentIdAndQuestionId(message.studentId(), question.getId())
                        .orElse(null);

                if (submission == null) {
                    log.warn("Submission record not found for studentId={}, questionId={}", message.studentId(), question.getId());
                    continue;
                }

                String extractedAnswerText = attempted ? text : "[Not Attempted / Could Not Be Mapped]";
                submission.setAnswerText(extractedAnswerText);
                submission.setNeedsReview(!attempted);
                submission.setGradingStatus("SCORING_QUEUED");
                Submission saved = submissionRepository.save(submission);

                EvaluationMessage evalMessage = new EvaluationMessage(
                        saved.getId(),
                        question.getId(),
                        extractedAnswerText
                );
                rabbitTemplate.convertAndSend(
                        RabbitMQConfig.EVAL_EXCHANGE,
                        RabbitMQConfig.SUBMISSION_SCORING_KEY,
                        evalMessage
                );
                log.info("Dispatched EvaluationMessage for submissionId={}, questionId={}", saved.getId(), question.getId());
            }

            progressBroadcasterService.broadcast(
                    studentEmail,
                    message.questionSetId(),
                    SubmissionProgressEvent.of(
                            null,
                            message.questionSetId(),
                            "OCR_COMPLETED",
                            60,
                            "Answer script segmented successfully into " + parsed.size() + " question(s). Queued for AI evaluation."
                    )
            );
        } catch (Exception ex) {
            log.error("Failed processing ScriptOcrMessage for studentId={}, questionSetId={}: {}",
                    message.studentId(), message.questionSetId(), ex.getMessage(), ex);
            progressBroadcasterService.broadcast(
                    studentEmail,
                    message.questionSetId(),
                    SubmissionProgressEvent.of(
                            null,
                            message.questionSetId(),
                            "FAILED",
                            30,
                            "OCR processing failed: " + ex.getMessage()
                    )
            );
            throw ex;
        }
    }
}
