package com.example.answereval.service;

import com.example.answereval.dto.SubmissionProgressEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ProgressBroadcasterService {

    private static final Logger log = LoggerFactory.getLogger(ProgressBroadcasterService.class);

    private final SimpMessagingTemplate messagingTemplate;

    public ProgressBroadcasterService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void notifyStudent(String studentEmail, SubmissionProgressEvent event) {
        if (studentEmail == null || studentEmail.isBlank()) {
            log.warn("Cannot notify student: missing studentEmail for event stage={}", event.stage());
            return;
        }
        log.info("Sending progress event to student {}: stage={}, progress={}%",
                studentEmail, event.stage(), event.progressPercentage());
        messagingTemplate.convertAndSendToUser(
                studentEmail,
                "/queue/submission-progress",
                event
        );
    }

    public void notifyTeacherExamRoom(UUID questionSetId, SubmissionProgressEvent event) {
        if (questionSetId == null) {
            log.warn("Cannot notify teacher exam room: missing questionSetId for event stage={}", event.stage());
            return;
        }
        String destination = "/topic/exam/" + questionSetId + "/progress";
        log.info("Broadcasting progress event to exam room {}: stage={}, progress={}%",
                destination, event.stage(), event.progressPercentage());
        messagingTemplate.convertAndSend(destination, event);
    }

    public void broadcast(String studentEmail, UUID questionSetId, SubmissionProgressEvent event) {
        notifyStudent(studentEmail, event);
        notifyTeacherExamRoom(questionSetId, event);
    }
}
