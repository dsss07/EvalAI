package com.example.answereval.listener;

import com.example.answereval.config.RabbitMQConfig;
import com.example.answereval.dto.EvaluationMessage;
import com.example.answereval.dto.SubmissionProgressEvent;
import com.example.answereval.entity.Submission;
import com.example.answereval.repository.SubmissionRepository;
import com.example.answereval.service.EvaluationService;
import com.example.answereval.service.ProgressBroadcasterService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Component
public class SubmissionScoringListener {

    private static final Logger log = LoggerFactory.getLogger(SubmissionScoringListener.class);

    private final EvaluationService evaluationService;
    private final SubmissionRepository submissionRepository;
    private final ProgressBroadcasterService progressBroadcasterService;

    public SubmissionScoringListener(
            EvaluationService evaluationService,
            SubmissionRepository submissionRepository,
            ProgressBroadcasterService progressBroadcasterService
    ) {
        this.evaluationService = evaluationService;
        this.submissionRepository = submissionRepository;
        this.progressBroadcasterService = progressBroadcasterService;
    }

    @RabbitListener(queues = RabbitMQConfig.SUBMISSION_SCORING_QUEUE)
    @Transactional
    public void onEvaluationMessage(EvaluationMessage message) {
        log.info("Received evaluation message for submissionId={}, questionId={}",
                message.submissionId(), message.questionId());

        Submission sub = submissionRepository.findById(message.submissionId()).orElse(null);
        String studentEmail = sub != null && sub.getStudent() != null ? sub.getStudent().getEmail() : null;
        UUID setId = sub != null && sub.getQuestion() != null && sub.getQuestion().getQuestionSet() != null
                ? sub.getQuestion().getQuestionSet().getId()
                : null;
        int questionOrder = sub != null && sub.getQuestion() != null ? sub.getQuestion().getQuestionOrder() : 1;

        progressBroadcasterService.broadcast(
                studentEmail,
                setId,
                SubmissionProgressEvent.of(
                        message.submissionId(),
                        setId,
                        "SCORING_IN_PROGRESS",
                        75,
                        "Evaluating Question " + questionOrder + " with semantic analysis and AI rubric."
                )
        );

        try {
            evaluationService.evaluate(message.submissionId());
            log.info("Completed evaluation for submissionId={}", message.submissionId());

            progressBroadcasterService.broadcast(
                    studentEmail,
                    setId,
                    SubmissionProgressEvent.of(
                            message.submissionId(),
                            setId,
                            "GRADED",
                            100,
                            "Question " + questionOrder + " evaluation completed."
                    )
            );
        } catch (Exception ex) {
            log.error("Failed to evaluate submissionId={}: {}", message.submissionId(), ex.getMessage(), ex);
            progressBroadcasterService.broadcast(
                    studentEmail,
                    setId,
                    SubmissionProgressEvent.of(
                            message.submissionId(),
                            setId,
                            "FAILED",
                            75,
                            "Grading failed: " + ex.getMessage()
                    )
            );
            throw ex; // re-throw to trigger RabbitMQ retry / dead-lettering
        }
    }
}
