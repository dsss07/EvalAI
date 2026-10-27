import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import { formatDateTime } from "../utils/dateUtils";

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string>;
}

export default function TakeMCQTestPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testData, setTestData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const { data } = await api.get(`/api/student/tests/${id}/mcq-questions`);
        setTestData(data);

        // Calculate remaining seconds based on end_time
        if (data.end_time) {
          const end = new Date(data.end_time).getTime();
          const now = new Date().getTime();
          setRemainingSeconds(Math.max(0, Math.floor((end - now) / 1000)));
        } else if (data.duration_minutes) {
          setRemainingSeconds(data.duration_minutes * 60);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load test.");
      } finally {
        setLoading(false);
      }
    };
    fetchTest();
  }, [id]);

  useEffect(() => {
    if (remainingSeconds === null || submitted) return;

    if (remainingSeconds <= 0) {
      handleSubmit(); // Auto-submit when time is up
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, submitted]);

  const selectOption = (qId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: option }));
  };

  const clearSelection = (qId: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setShowConfirm(false);

    const payload = {
      answers: testData.questions.map((q: Question) => ({
        question_id: q.id,
        selected_option: answers[q.id] || null,
      })),
    };

    try {
      await api.post(`/api/student/tests/${id}/submit-mcq`, payload);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to submit test.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !testData) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-center shadow-lg">
        <span className="text-5xl mx-auto mb-4 block">⚠️</span>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Unable to Access Assessment
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
          {error}
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-all shadow-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-20 p-10 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl rounded-3xl text-center">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 shadow-sm">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Assessment Submitted Successfully
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed">
          Your multiple-choice responses have been securely recorded. You can view
          your finalized marks and detailed question review once results are released.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/my-results"
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all shadow-sm shadow-blue-500/20 text-center"
          >
            Go to My Results ➔
          </Link>
          <button
            onClick={() => navigate("/")}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-all text-center"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isLowTime = remainingSeconds !== null && remainingSeconds < 300; // < 5 mins
  const isCriticalTime = remainingSeconds !== null && remainingSeconds < 60; // < 1 min

  const questions: Question[] = testData?.questions || [];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const progressPct =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const scrollToQuestion = (qId: string) => {
    const el = document.getElementById(`q-${qId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-36 pt-4">
      {/* Sticky Top Header Banner */}
      <div className="sticky top-20 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              MCQ Assessment
            </span>
            {testData?.subject && (
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
                📚 {testData.subject}
              </span>
            )}
          </div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate mt-1">
            {testData?.title}
          </h1>
          {testData?.end_time && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Deadline:{" "}
              <strong className="text-slate-700 dark:text-slate-300 font-medium">
                {formatDateTime(testData.end_time)}
              </strong>
            </p>
          )}
        </div>

        {/* Live Timer Pill */}
        {remainingSeconds !== null && (
          <div
            className={`flex items-center gap-2 font-mono text-xl md:text-2xl font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${
              isCriticalTime
                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 animate-pulse"
                : isLowTime
                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900"
            }`}
          >
            <span className="text-lg">⏱️</span>
            <span>{formatTime(remainingSeconds)}</span>
          </div>
        )}
      </div>

      {/* Quick Navigation Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <span>Question Navigator</span>
          <span>
            {answeredCount} of {totalQuestions} Answered
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {questions.map((q, idx) => {
            const isAnswered = Boolean(answers[q.id]);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => scrollToQuestion(q.id)}
                className={`w-9 h-9 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${
                  isAnswered
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
                title={`Jump to Question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 text-sm">
          {error}
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((q: Question, idx: number) => {
          const isAnswered = Boolean(answers[q.id]);
          return (
            <div
              id={`q-${q.id}`}
              key={q.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all scroll-mt-28"
            >
              <div className="flex justify-between items-start mb-5 gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                      Question {idx + 1}
                    </span>
                    {isAnswered && (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span>✓</span> Answered
                      </span>
                    )}
                  </div>
                  <h3 className="text-base md:text-lg text-slate-900 dark:text-white font-medium leading-relaxed">
                    {q.question_text}
                  </h3>
                </div>

                {answers[q.id] && (
                  <button
                    onClick={() => clearSelection(q.id)}
                    className="text-xs font-medium text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors flex-shrink-0 px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    Clear Choice
                  </button>
                )}
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {Object.entries(q.options || {}).map(([key, val]) => {
                  const isSelected = answers[q.id] === key;
                  return (
                    <label
                      key={key}
                      onClick={() => selectOption(q.id, key)}
                      className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-sm"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full border flex items-center justify-center mr-3 shrink-0 font-bold text-xs mt-0.5 transition-all ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                            : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {key}
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium leading-relaxed">
                          {val as string}
                        </span>
                      </div>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={key}
                        checked={isSelected}
                        onChange={() => selectOption(q.id, key)}
                        className="hidden"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex justify-center z-40 shadow-lg">
        <div className="max-w-4xl w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-auto flex-1 max-w-sm">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              <span>Exam Progress</span>
              <span>
                {answeredCount} / {totalQuestions} answered ({progressPct}%)
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            Review & Submit Test ➔
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl max-w-md w-full border border-slate-200/80 dark:border-slate-800 shadow-2xl">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center text-2xl mb-4">
              📝
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Ready to Submit?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              You have answered{" "}
              <strong className="text-slate-900 dark:text-white font-bold">
                {answeredCount}
              </strong>{" "}
              out of{" "}
              <strong className="text-slate-900 dark:text-white font-bold">
                {totalQuestions}
              </strong>{" "}
              questions.
            </p>

            {totalQuestions - answeredCount > 0 && (
              <div className="mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                ⚠️ Notice: You still have{" "}
                <strong>{totalQuestions - answeredCount}</strong> unanswered{" "}
                {totalQuestions - answeredCount === 1 ? "question" : "questions"}.
                Unanswered questions receive 0 marks.
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-semibold text-sm transition-colors"
              >
                Keep Answering
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm shadow-blue-500/20 flex justify-center items-center transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Confirm & Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
