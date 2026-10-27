package com.example.answereval.service;

import com.example.answereval.dto.SubmissionProgressEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProgressBroadcasterServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private ProgressBroadcasterService broadcasterService;

    private UUID submissionId;
    private UUID questionSetId;
    private SubmissionProgressEvent sampleEvent;

    @BeforeEach
    void setUp() {
        submissionId = UUID.randomUUID();
        questionSetId = UUID.randomUUID();
        sampleEvent = SubmissionProgressEvent.of(
                submissionId,
                questionSetId,
                "OCR_IN_PROGRESS",
                30,
                "Analyzing answer script."
        );
    }

    @Test
    void shouldSendProgressToStudentQueue() {
        String studentEmail = "student@test.edu";
        broadcasterService.notifyStudent(studentEmail, sampleEvent);

        verify(messagingTemplate, times(1)).convertAndSendToUser(
                eq(studentEmail),
                eq("/queue/submission-progress"),
                eq(sampleEvent)
        );
    }

    @Test
    void shouldBroadcastProgressToTeacherExamRoomTopic() {
        broadcasterService.notifyTeacherExamRoom(questionSetId, sampleEvent);

        verify(messagingTemplate, times(1)).convertAndSend(
                eq("/topic/exam/" + questionSetId + "/progress"),
                eq(sampleEvent)
        );
    }

    @Test
    void shouldBroadcastToBothStudentAndTeacherRoom() {
        String studentEmail = "student@test.edu";
        broadcasterService.broadcast(studentEmail, questionSetId, sampleEvent);

        verify(messagingTemplate, times(1)).convertAndSendToUser(
                eq(studentEmail),
                eq("/queue/submission-progress"),
                eq(sampleEvent)
        );
        verify(messagingTemplate, times(1)).convertAndSend(
                eq("/topic/exam/" + questionSetId + "/progress"),
                eq(sampleEvent)
        );
    }

    @Test
    void shouldIgnoreNullStudentEmailGracefully() {
        broadcasterService.notifyStudent(null, sampleEvent);
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    void shouldIgnoreNullQuestionSetIdGracefully() {
        broadcasterService.notifyTeacherExamRoom(null, sampleEvent);
        verifyNoInteractions(messagingTemplate);
    }
}
