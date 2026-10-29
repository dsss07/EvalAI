interface SubmissionProgressStepperProps {
  currentStage?: string;
  progressPercentage?: number;
  message?: string;
  timestamp?: string;
  error?: string | null;
}

interface StepItem {
  id: number;
  label: string;
  description: string;
  minPercentage: number;
  stages: string[];
}

const STEPS: StepItem[] = [
  {
    id: 1,
    label: "Uploaded & Queued",
    description: "Script safely stored & queued",
    minPercentage: 10,
    stages: ["QUEUED"],
  },
  {
    id: 2,
    label: "AI Vision OCR",
    description: "VLM answer script segmentation",
    minPercentage: 30,
    stages: ["OCR_IN_PROGRESS", "OCR_COMPLETED"],
  },
  {
    id: 3,
    label: "Semantic Scoring",
    description: "Keywords & AI rubric evaluation",
    minPercentage: 60,
    stages: ["SCORING_IN_PROGRESS"],
  },
  {
    id: 4,
    label: "Evaluation Complete",
    description: "Grades and feedback finalized",
    minPercentage: 100,
    stages: ["GRADED"],
  },
];

export default function SubmissionProgressStepper({
  currentStage = "QUEUED",
  progressPercentage = 10,
  message = "Submission uploaded and queued for processing.",
  timestamp,
  error,
}: SubmissionProgressStepperProps) {
  const isFailed = currentStage === "FAILED" || Boolean(error);
  const parsedPercentage = Number(progressPercentage);
  const safePercentage = isNaN(parsedPercentage)
    ? (currentStage === "GRADED" ? 100 : 10)
    : parsedPercentage;

  const percentage = isFailed
    ? Math.max(safePercentage, 10)
    : Math.min(Math.max(safePercentage, 10), 100);

  const isCompleted = percentage >= 100 || currentStage === "GRADED";

  const getStepState = (stepIndex: number) => {
    if (isFailed) {
      return "failed";
    }

    if (isCompleted) {
      return "completed";
    }

    const stageIndex = STEPS.findIndex((s) => s.stages.includes(currentStage));
    const percentIndex = STEPS.findIndex((s, idx) => {
      const next = STEPS[idx + 1];
      if (next) {
        return percentage >= s.minPercentage && percentage < next.minPercentage;
      }
      return percentage >= s.minPercentage;
    });

    const currentStepIndex = Math.max(stageIndex, percentIndex);

    if (stepIndex < currentStepIndex) {
      return "completed";
    }
    if (stepIndex === currentStepIndex) {
      return "in_progress";
    }
    return "pending";
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 space-y-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
      {/* Top Header & Percentage */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Evaluation Pipeline
            </h3>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border uppercase tracking-wider font-semibold ${
                isFailed
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                  : isCompleted
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
              }`}
            >
              {isFailed
                ? "Failed"
                : isCompleted
                ? "Completed"
                : "In Progress"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time automated status updates via WebSocket connection
          </p>
        </div>

        <div className="flex items-baseline gap-1.5 self-start sm:self-auto">
          <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
            {isCompleted ? 100 : percentage}%
          </span>
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Complete
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
        <div
          className={`h-full transition-all duration-700 ease-out rounded-full ${
            isFailed
              ? "bg-rose-500"
              : isCompleted
              ? "bg-emerald-500"
              : "bg-blue-600"
          }`}
          style={{ width: `${isCompleted ? 100 : percentage}%` }}
        />
      </div>

      {/* Stepper Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {STEPS.map((step, idx) => {
          const state = getStepState(idx);
          return (
            <div
              key={step.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                state === "completed"
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                  : state === "in_progress"
                  ? "bg-blue-50/60 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                  : state === "failed" && idx === 0
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
                  : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-70"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  STAGE 0{step.id}
                </span>
                {state === "completed" && (
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                    ✓
                  </span>
                )}
                {state === "in_progress" && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold animate-spin">
                    ⚙
                  </span>
                )}
                {state === "pending" && (
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
                    {step.id}
                  </span>
                )}
                {state === "failed" && (
                  <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold">
                    !
                  </span>
                )}
              </div>

              <div>
                <h4
                  className={`text-xs sm:text-sm font-bold mb-1 ${
                    state === "completed"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : state === "in_progress"
                      ? "text-blue-700 dark:text-blue-300 font-extrabold"
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {step.label}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Status Note */}
      {!isFailed && (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
          <span className="text-base mt-0.5">ℹ️</span>
          <div className="flex-1 text-xs">
            <span className="text-slate-800 dark:text-slate-200 font-semibold">
              {message}
            </span>
            {timestamp && (
              <span className="block text-slate-400 mt-0.5">
                Last event: {new Date(timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Failure Callout */}
      {isFailed && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div className="flex-1 text-xs text-rose-700 dark:text-rose-300">
            <h4 className="font-bold">Evaluation Pipeline Error</h4>
            <p className="mt-1">
              {error || message || "System error during answer evaluation."}
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Please notify your course faculty or try submitting again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
