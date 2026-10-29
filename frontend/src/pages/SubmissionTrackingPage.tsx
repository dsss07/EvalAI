import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import api from "../api/client";
import { useSubmissionProgress } from "../hooks/useSubmissionProgress";
import SubmissionProgressStepper from "../components/SubmissionProgressStepper";
import type { Submission } from "../types";

export default function SubmissionTrackingPage() {
  const { id: submissionId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const querySetId = searchParams.get("setId");
  const queryTitle = searchParams.get("title");

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [examTitle, setExamTitle] = useState<string>(
    queryTitle || "Exam Assessment"
  );
  const [loading, setLoading] = useState(!queryTitle);

  const setId =
    querySetId || (submission as any)?.question?.questionSet?.id || undefined;

  const [maxPercentage, setMaxPercentage] = useState<number>(10);
  const [highestStage, setHighestStage] = useState<string>("QUEUED");
  const [latestMessage, setLatestMessage] = useState<string>(
    "Connecting to real-time evaluation pipeline..."
  );

  const STAGE_ORDER: Record<string, number> = {
    QUEUED: 1,
    OCR_IN_PROGRESS: 2,
    OCR_COMPLETED: 2,
    SCORING_IN_PROGRESS: 3,
    GRADED: 4,
    FAILED: 5,
  };

  // Real-time STOMP WebSocket progress hook
  const { event, connected, error: socketError } = useSubmissionProgress({
    submissionId,
    questionSetId: setId,
  });

  useEffect(() => {
    if (event) {
      if (event.message) {
        setLatestMessage(event.message);
      }
      const rawPct =
        event.progressPercentage ?? (event as any).progress_percentage;
      const parsedPct =
        typeof rawPct === "number" ? rawPct : parseFloat(rawPct);
      const safePct = !isNaN(parsedPct) ? parsedPct : 10;

      setMaxPercentage((prev) => Math.max(isNaN(prev) ? 10 : prev, safePct));
      setHighestStage((prev) => {
        const prevOrder = STAGE_ORDER[prev] || 0;
        const newOrder = STAGE_ORDER[event.stage] || 0;
        return newOrder >= prevOrder ? event.stage : prev;
      });
    }
  }, [event]);

  useEffect(() => {
    if (submission?.grades && submission.grades.length > 0) {
      setMaxPercentage(100);
      setHighestStage("GRADED");
      setLatestMessage("Evaluation completed.");
    }
  }, [submission]);

  useEffect(() => {
    if (submissionId) {
      api
        .get(`/api/submissions/${submissionId}`)
        .then(({ data }) => {
          setSubmission(data);
          if (data.question?.questionSet?.title) {
            setExamTitle(data.question.questionSet.title);
          }
        })
        .catch((err) => {
          console.error("Could not fetch submission details", err);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [submissionId]);

  const currentStage = highestStage;
  const progressPercentage = maxPercentage;
  const message =
    latestMessage ||
    (connected
      ? "Connected to real-time evaluator. Awaiting OCR / scoring pipeline..."
      : "Connecting to real-time evaluation pipeline...");
  const isFinished = progressPercentage === 100 || currentStage === "GRADED";

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Breadcrumb & Status */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {connected ? "WebSocket Connected" : "Connecting..."}
            </span>
          </div>
        </div>

        {/* Assessment Header Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 uppercase tracking-wider">
              Live Progress Tracking
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-2">
              {examTitle}
            </h1>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Submission ID: {submissionId || "Pending"}
            </p>
          </div>

          {submission?.submitted_at && (
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                Turn-in Time
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {new Date(submission.submitted_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Real-time Stepper Pipeline */}
        <SubmissionProgressStepper
          currentStage={currentStage}
          progressPercentage={progressPercentage}
          message={message}
          timestamp={event?.timestamp}
          error={socketError}
        />

        {/* Action Button after finish */}
        {isFinished && (
          <div className="flex justify-center pt-2">
            <Link
              to="/my-results"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-all flex items-center gap-2"
            >
              <span>🎓</span>
              <span>View Your Evaluation Results</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
