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
            const payload: SubmissionProgressEvent = JSON.parse(message.body);

            // If a specific submissionId is watched, skip events belonging to another submission
            if (options?.submissionId && payload.submissionId && payload.submissionId !== options.submissionId) {
              return;
            }
            // If a specific questionSetId is watched, skip events belonging to another set
            if (options?.questionSetId && payload.questionSetId && payload.questionSetId !== options.questionSetId) {
              return;
            }

            setEvent(payload);
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
