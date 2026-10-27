import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import type { QuestionSetDetail, Submission } from "../types";
import { getDeadlineStatus, formatDateTime } from "../utils/dateUtils";

export default function TakeExamPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [set, setSet] = useState<QuestionSetDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Submission>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadFiles, setUploadFiles] = useState<Record<string, File | null>>({});
  const [fullScriptFiles, setFullScriptFiles] = useState<FileList | null>(null);
  const [submittingFull, setSubmittingFull] = useState(false);
  const [fullScriptError, setFullScriptError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/api/question-sets/${id}`)
      .then(({ data }) => {
        const questionSet = {
          ...data.set,
          teacherName: data.teacherName,
          questions: data.questions,
        };

        setSet(questionSet);

        const init: Record<string, string> = {};
        questionSet.questions.forEach((q: { id: string }) => {
          init[q.id] = "";
        });

        setAnswers(init);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const submitAnswer = async (questionId: string) => {
    if (deadlineInfo?.isExpired || deadlineInfo?.isUpcoming) return;
    const text = answers[questionId]?.trim();
    const file = uploadFiles[questionId];

    if (!text && !file) return;

    setSubmitting(questionId);
    try {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.post(
          `/api/questions/${questionId}/submit-scanned`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        setResults((r) => ({ ...r, [questionId]: data }));
      } else {
        const { data } = await api.post(`/api/questions/${questionId}/submit`, {
          answer_text: text,
        });
        setResults((r) => ({ ...r, [questionId]: data }));
      }
    } catch (err) {
      console.error("Submit failed", err);
    } finally {
      setSubmitting(null);
    }
  };

  const submitFullScript = async () => {
    if (!fullScriptFiles || fullScriptFiles.length === 0 || !set) return;
    if (deadlineInfo?.isExpired) {
      setFullScriptError(
        "Cannot submit: the deadline for this assessment has already passed."
      );
      return;
    }
    if (deadlineInfo?.isUpcoming) {
      setFullScriptError(
        "Cannot submit: the assessment window has not opened yet."
      );
      return;
    }
    setSubmittingFull(true);
    setFullScriptError(null);
    try {
      const formData = new FormData();
      for (let i = 0; i < fullScriptFiles.length; i++) {
        formData.append("files", fullScriptFiles[i]);
      }
      const { data } = await api.post(
        `/api/question-sets/${set.id}/submit-full-script`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const firstSubId = Array.isArray(data) && data[0]?.id ? data[0].id : "";
      navigate(
        `/student/submissions/${firstSubId}?setId=${set.id}&title=${encodeURIComponent(
          set.title
        )}`
      );
    } catch (err: any) {
      console.error("Full script submission failed", err);
      const serverMsg =
        err?.response?.data?.message || err?.response?.data?.detail;
      setFullScriptError(
        serverMsg || "Full script submission failed. Please try again."
      );
    } finally {
      setSubmittingFull(false);
    }
  };

  const allDone = set ? set.questions.every((q) => q.id in results) : false;
  const deadlineInfo = set
    ? getDeadlineStatus(set.start_time, set.end_time, set.grace_period_minutes)
    : null;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!set) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-slate-500 gap-3">
        <span className="text-3xl">⚠️</span>
        <p className="text-sm font-semibold">Assessment not found.</p>
        <Link to="/" className="text-xs text-blue-600 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Dashboard
          </Link>
          <span>›</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs sm:max-w-md">
            {set.title}
          </span>
        </div>

        {/* Assessment Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 uppercase tracking-wider">
              Descriptive Exam
            </span>
            {set.subject && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                {set.subject}
              </span>
            )}
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {set.branch} · Sem {set.semester}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {set.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Answer each question below and submit, or upload your full handwritten exam script in a single submission.
          </p>
        </div>

        {/* Assessment Window & Deadline Banner */}
        {deadlineInfo && deadlineInfo.hasDeadline && (
          <div
            className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
              deadlineInfo.isExpired
                ? "border-rose-200 bg-rose-50/60 dark:bg-rose-950/20 dark:border-rose-900/50"
                : deadlineInfo.isGrace
                ? "border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/50"
                : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/40"
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-2xl">
                {deadlineInfo.isExpired
                  ? "🚫"
                  : deadlineInfo.isGrace
                  ? "⏳"
                  : "⏰"}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Submission Window
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${deadlineInfo.badgeClass}`}
                  >
                    {deadlineInfo.label}
                  </span>
                </div>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {deadlineInfo.formattedDeadline}
                </p>
                {set.start_time && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Opened at: {formatDateTime(set.start_time)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1">
              {set.grace_period_minutes ? (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  ⏱️ +{set.grace_period_minutes}m buffer grace period
                </span>
              ) : null}
              {deadlineInfo.isExpired && (
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  The deadline has passed. Submissions are locked.
                </span>
              )}
              {deadlineInfo.isGrace && (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                  Grace window active — submit immediately!
                </span>
              )}
            </div>
          </div>
        )}

        {/* Upload Full Exam Script Card */}
        {!allDone && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-1">
                  Recommended Workflow
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Upload Full Handwritten Exam Script
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  If you have handwritten your answers on physical paper, scan or photograph your pages and upload them as a single PDF or image set. Ensure each answer clearly starts with the question marker (e.g. <strong>Q1.</strong>, <strong>Q2.</strong>).
                </p>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <input
                type="file"
                id="full-script-input"
                multiple
                accept=".pdf,image/*"
                onChange={(e) => setFullScriptFiles(e.target.files)}
                className="text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />

              <button
                onClick={submitFullScript}
                disabled={
                  !fullScriptFiles ||
                  fullScriptFiles.length === 0 ||
                  submittingFull ||
                  !!deadlineInfo?.isExpired ||
                  !!deadlineInfo?.isUpcoming
                }
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50 shrink-0 flex items-center gap-2"
              >
                {submittingFull ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Uploading Script...</span>
                  </>
                ) : (
                  <span>Submit Full Script</span>
                )}
              </button>
            </div>

            {fullScriptError && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                ⚠️ {fullScriptError}
              </p>
            )}
          </div>
        )}

        {/* Question-by-question Cards */}
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Questions & Single Answer Submissions
            </h2>
            <span className="text-xs text-slate-400 font-semibold">
              {set.questions.length} Questions
            </span>
          </div>

          {set.questions.map((q, i) => {
            const done = q.id in results;
            const sub = results[q.id];
            const aiGrade = sub?.grades?.find((g) => g.grader_type === "ai");

            return (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    Question {i + 1} · {q.max_marks} Marks
                  </span>

                  {done && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                      ✓ Submitted
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {q.question_text}
                </p>

                {/* Input area if not done */}
                {!done && (
                  <div className="space-y-3 pt-2">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`mode-${q.id}`}
                          checked={!uploadFiles[q.id]}
                          onChange={() =>
                            setUploadFiles((f) => ({ ...f, [q.id]: null }))
                          }
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        Type Answer
                      </label>

                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`mode-${q.id}`}
                          checked={!!uploadFiles[q.id]}
                          onChange={() => {
                            const el = document.getElementById(
                              `file-${q.id}`
                            ) as HTMLInputElement;
                            if (el) el.click();
                          }}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        Upload Scanned Image
                      </label>
                    </div>

                    {!uploadFiles[q.id] ? (
                      <textarea
                        value={answers[q.id] || ""}
                        onChange={(e) =>
                          setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                        }
                        disabled={done}
                        rows={4}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        placeholder="Type your answer text here..."
                      />
                    ) : (
                      <div className="w-full px-4 py-6 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center gap-1.5">
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          📎 {uploadFiles[q.id]?.name}
                        </span>
                        <button
                          onClick={() =>
                            setUploadFiles((f) => ({ ...f, [q.id]: null }))
                          }
                          className="text-[11px] text-slate-400 hover:text-rose-500"
                        >
                          Remove file
                        </button>
                      </div>
                    )}

                    <input
                      type="file"
                      id={`file-${q.id}`}
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setUploadFiles((f) => ({
                            ...f,
                            [q.id]: e.target.files![0],
                          }));
                        }
                      }}
                    />

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => submitAnswer(q.id)}
                        disabled={
                          submitting === q.id ||
                          (!answers[q.id]?.trim() && !uploadFiles[q.id]) ||
                          !!deadlineInfo?.isExpired ||
                          !!deadlineInfo?.isUpcoming
                        }
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold rounded-xl text-xs shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {submitting === q.id ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : (
                          "Submit Answer"
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Submitted confirmation card */}
                {done && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    {sub?.needs_review ? (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                        <span>⚠️</span>
                        <span>Answer queued for teacher review.</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                        {sub?.answer_text}
                      </p>
                    )}

                    {aiGrade && (
                      <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                        <span className="text-blue-600 dark:text-blue-400">
                          AI Preliminary Score:
                        </span>
                        <span className="text-blue-900 dark:text-blue-200 font-bold">
                          {aiGrade.score} / {aiGrade.max_score}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* All questions completed summary banner */}
        {allDone && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3 shadow-sm">
            <span className="text-3xl block">🎉</span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              All answers have been successfully submitted!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Your responses are in the pipeline. Once faculty completes grading, finalized marks will appear in your results view.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                to="/"
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
              <Link
                to="/my-results"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm"
              >
                Go to My Results
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
