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

import java.util.List;
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
        UUID studentId = sub != null && sub.getStudent() != null ? sub.getStudent().getId() : null;
        int questionOrder = sub != null && sub.getQuestion() != null && sub.getQuestion().getQuestionOrder() != null && sub.getQuestion().getQuestionOrder() > 0
                ? sub.getQuestion().getQuestionOrder()
                : 1;

        List<Submission> allSubs = (studentId != null && setId != null)
                ? submissionRepository.findByStudentIdAndQuestionQuestionSetId(studentId, setId)
                : (sub != null ? List.of(sub) : List.of());
        int totalQuestions = Math.max(1, allSubs.size());

        long alreadyGraded = allSubs.stream()
                .filter(s -> "GRADED".equalsIgnoreCase(s.getGradingStatus()) || "TEACHER_REVIEWED".equalsIgnoreCase(s.getGradingStatus()))
                .count();

        int startProgress = totalQuestions > 1
                ? Math.min(95, 60 + (int) Math.round((alreadyGraded * 35.0) / totalQuestions) + 2)
                : 75;

        String startMsg = totalQuestions > 1
                ? "Evaluating Question " + questionOrder + " of " + totalQuestions + " with semantic analysis and AI rubric."
                : "Evaluating Question " + questionOrder + " with semantic analysis and AI rubric.";

        progressBroadcasterService.broadcast(
                studentEmail,
                setId,
                SubmissionProgressEvent.of(
                        message.submissionId(),
                        setId,
                        "SCORING_IN_PROGRESS",
                        startProgress,
                        startMsg
                )
        );

        try {
            evaluationService.evaluate(message.submissionId());
            log.info("Completed evaluation for submissionId={}", message.submissionId());

            List<Submission> updatedSubs = (studentId != null && setId != null)
                    ? submissionRepository.findByStudentIdAndQuestionQuestionSetId(studentId, setId)
                    : (sub != null ? List.of(sub) : List.of());
            long finishedCount = updatedSubs.stream()
                    .filter(s -> "GRADED".equalsIgnoreCase(s.getGradingStatus()) || "TEACHER_REVIEWED".equalsIgnoreCase(s.getGradingStatus()))
                    .count();

            boolean allComplete = totalQuestions <= 1 || finishedCount >= totalQuestions;
            int completedProgress = allComplete ? 100 : Math.min(95, 60 + (int) Math.round((finishedCount * 35.0) / totalQuestions));
            String stage = allComplete ? "GRADED" : "SCORING_IN_PROGRESS";
            String statusMsg = allComplete
                    ? (totalQuestions > 1 ? "All " + totalQuestions + " questions evaluated and graded successfully." : "Question " + questionOrder + " evaluation completed.")
                    : "Question " + questionOrder + " of " + totalQuestions + " evaluated. Continuing next question...";

            progressBroadcasterService.broadcast(
                    studentEmail,
                    setId,
                    SubmissionProgressEvent.of(
                            message.submissionId(),
                            setId,
                            stage,
                            completedProgress,
                            statusMsg
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
                            startProgress,
                            "Grading failed for Question " + questionOrder + ": " + ex.getMessage()
                    )
            );
            throw ex; // re-throw to trigger RabbitMQ retry / dead-lettering
        }
    }
}
