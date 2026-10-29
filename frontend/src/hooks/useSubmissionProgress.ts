import { useEffect, useState, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import type { SubmissionProgressEvent } from "../types";

export interface UseSubmissionProgressOptions {
  submissionId?: string;
  questionSetId?: string;
}

export interface UseSubmissionProgressReturn {
  event: SubmissionProgressEvent | null;
  connected: boolean;
  error: string | null;
}

export function useSubmissionProgress(options?: UseSubmissionProgressOptions): UseSubmissionProgressReturn {
  const [event, setEvent] = useState<SubmissionProgressEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("User is not authenticated");
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS("/ws-eval"),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 4000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        setConnected(true);
        setError(null);

        client.subscribe("/user/queue/submission-progress", (message) => {
          try {
            const raw: any = JSON.parse(message.body);

            const submissionId = raw.submissionId || raw.submission_id || null;
            const questionSetId = raw.questionSetId || raw.question_set_id || null;
            const rawProgress = raw.progressPercentage ?? raw.progress_percentage;
            const parsedProgress =
              typeof rawProgress === "number"
                ? rawProgress
                : parseFloat(rawProgress);
            const progressPercentage = !isNaN(parsedProgress)
              ? parsedProgress
              : 10;

            const normalized: SubmissionProgressEvent = {
              submissionId,
              submission_id: submissionId,
              questionSetId,
              question_set_id: questionSetId,
              stage: raw.stage || "QUEUED",
              progressPercentage,
              progress_percentage: progressPercentage,
              message: raw.message || "",
              timestamp: raw.timestamp || new Date().toISOString(),
            };

            // If questionSetId is specified, match on questionSetId (allowing all questions in this exam)
            if (options?.questionSetId) {
              if (questionSetId && questionSetId !== options.questionSetId) {
                return;
              }
            } else if (options?.submissionId) {
              // Otherwise, if only submissionId is specified, match on submissionId
              if (submissionId && submissionId !== options.submissionId) {
                return;
              }
            }

            setEvent(normalized);
          } catch (err) {
            console.error("Failed to parse submission progress payload", err);
          }
        });
      },
      onStompError: (frame) => {
        console.error("STOMP protocol error:", frame.headers["message"], frame.body);
        setError(frame.headers["message"] || "STOMP protocol error");
      },
      onWebSocketClose: () => {
        setConnected(false);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [options?.submissionId, options?.questionSetId]);

  return { event, connected, error };
}
