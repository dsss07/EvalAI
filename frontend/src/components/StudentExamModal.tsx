import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import type { QuestionSet, Question, StudentAssessmentStatus } from "../types";
import { formatDateTime, getDeadlineStatus } from "../utils/dateUtils";

interface StudentExamModalProps {
  set: QuestionSet;
  isSubmitted: boolean;
  onClose: () => void;
}

export default function StudentExamModal({
  set,
  isSubmitted: initialSubmitted,
  onClose,
}: StudentExamModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teacherName, setTeacherName] = useState<string>("");
  const [statusData, setStatusData] = useState<StudentAssessmentStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchExamData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [setRes, statusRes] = await Promise.all([
          api.get(`/api/question-sets/${set.id}`),
          api.get(`/api/question-sets/${set.id}/my-status`).catch(() => ({ data: null })),
        ]);

        if (!mounted) return;

        const data = setRes.data;
        const qsList: Question[] = data.questions || [];
        setQuestions(qsList);
        setTeacherName(data.teacherName || data.teacher_name || "");

        if (statusRes && statusRes.data) {
          setStatusData(statusRes.data);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error("Failed to fetch exam details", err);
        setError(err.response?.data?.detail || "Could not load examination details.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchExamData();
    return () => {
      mounted = false;
    };
  }, [set.id]);

  const deadlineInfo = getDeadlineStatus(
    set.start_time,
    set.end_time,
    set.grace_period_minutes
  );

  const isSubmitted = statusData?.submitted || initialSubmitted;
  const isSkipped = !isSubmitted && deadlineInfo.isExpired;
  const isYetToSubmit = !isSubmitted && !deadlineInfo.isExpired;

  const totalMarks = questions.reduce((acc, q) => acc + (q.max_marks || 0), 0);

  const handleStartExam = () => {
    onClose();
    if (set.test_type === "MCQ") {
      navigate(`/student/test/${set.id}`);
    } else {
      navigate(`/test/${set.id}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Top Bar */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {/* Status Pill */}
              {isSubmitted ? (
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 shadow-sm">
                  <span>✓</span> Submitted
                </span>
              ) : isSkipped ? (
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1.5 shadow-sm">
                  <span>✕</span> Skipped
                </span>
              ) : (
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5 shadow-sm">
                  <span>⏳</span> Yet to submit
                </span>
              )}

              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                {set.test_type === "MCQ" ? "MCQ Assessment" : "Descriptive Script"}
              </span>

              {set.subject && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  📚 {set.subject}
                </span>
              )}

              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                {set.branch} · Sem {set.semester} · Sec {set.section}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">
              {set.title}
            </h2>

            {teacherName && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Conducted by: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{teacherName}</strong>
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center font-bold text-base transition-colors shrink-0"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/40 dark:bg-slate-950/40">
          {/* Submission Status Highlight Banner */}
          {isSubmitted && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center text-xl shrink-0 shadow-sm">
                  ✓
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-200 text-base">
                    Assessment Submitted Successfully
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5 leading-relaxed">
                    {statusData?.submittedAt ? (
                      <>Your answer script was recorded on <strong>{formatDateTime(statusData.submittedAt)}</strong>.</>
                    ) : (
                      <>Your responses have been recorded securely in the portal.</>
                    )}
                    {statusData?.gradingStatus && (
                      <span className="block mt-0.5 font-medium">
                        Current Status: <span className="uppercase font-bold tracking-wider">{statusData.gradingStatus}</span>
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <Link
                to="/my-results"
                onClick={onClose}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all whitespace-nowrap self-stretch sm:self-auto text-center"
              >
                View Graded Results ➔
              </Link>
            </div>
          )}

          {isSkipped && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 shadow-sm flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white font-bold flex items-center justify-center text-xl shrink-0 shadow-sm">
                ✕
              </div>
              <div>
                <h4 className="font-bold text-rose-900 dark:text-rose-200 text-base">
                  Assessment Window Closed (Skipped)
                </h4>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
                  The deadline for this assessment passed on <strong>{deadlineInfo.formattedDeadline || "the scheduled cutoff"}</strong>. No submission was recorded before the window closed.
                </p>
              </div>
            </div>
          )}

          {isYetToSubmit && (
            <div className={`border rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              deadlineInfo.isUpcoming
                ? "bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60"
            }`}>
              <div className="flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-xl text-white font-bold flex items-center justify-center text-xl shrink-0 shadow-sm ${
                  deadlineInfo.isUpcoming ? "bg-slate-500" : "bg-blue-600"
                }`}>
                  {deadlineInfo.isUpcoming ? "🕒" : "⏳"}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    {deadlineInfo.isUpcoming
                      ? "Upcoming Assessment · Yet to Submit"
                      : "Window Open · Yet to Submit"}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {deadlineInfo.isUpcoming ? (
                      <>This assessment is scheduled to open on <strong>{deadlineInfo.formattedStart}</strong>.</>
                    ) : (
                      <>You have not submitted yet. Complete and submit your work before <strong>{deadlineInfo.formattedDeadline}</strong>.</>
                    )}
                  </p>
                </div>
              </div>

              {!deadlineInfo.isUpcoming && (
                <button
                  onClick={handleStartExam}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition-all whitespace-nowrap self-stretch sm:self-auto text-center"
                >
                  Start Assessment Now ➔
                </button>
              )}
            </div>
          )}

          {/* Exam Details 4-Box Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Start Time
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                {set.start_time ? formatDateTime(set.start_time) : "Flexible"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Deadline
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                {set.end_time ? formatDateTime(set.end_time) : "No Deadline"}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Allocated Time
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                {set.duration_minutes ? `${set.duration_minutes} Mins` : "Self-paced"}
                {set.grace_period_minutes ? ` (+${set.grace_period_minutes}m grace)` : ""}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Marks
              </span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1 block">
                {totalMarks} Marks ({questions.length} Qs)
              </span>
            </div>
          </div>

          {/* Description & Teacher Guidelines */}
          {set.description && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Faculty Guidelines / Instructions
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {set.description}
              </p>
            </div>
          )}

          {/* Questions Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>📄</span>
                  <span>Question Paper</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    ({questions.length} {questions.length === 1 ? "Question" : "Questions"})
                  </span>
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {isSubmitted
                    ? "Your responses have been recorded for the following questions."
                    : "Review the question prompts and maximum marks assigned for each question."}
                </p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                Total: {totalMarks} Marks
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 text-xs">
                {error}
              </div>
            ) : questions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
                No individual questions registered in this assessment paper yet.
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Q{q.order || idx + 1}
                        </span>
                        {isSubmitted && (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span>✓</span> Answer Submitted
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 shrink-0">
                        {q.max_marks} {q.max_marks === 1 ? "Mark" : "Marks"}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                      {q.question_text}
                    </p>

                    {/* MCQ Options Display if available */}
                    {q.options && Object.keys(q.options).length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        {Object.entries(q.options).map(([key, val]) => (
                          <div
                            key={key}
                            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2"
                          >
                            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {key}
                            </span>
                            <span className="truncate">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {isSubmitted && (
              <Link
                to="/my-results"
                onClick={onClose}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                Go to My Results ➔
              </Link>
            )}

            {isYetToSubmit && !deadlineInfo.isUpcoming && (
              <button
                onClick={handleStartExam}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all"
              >
                Start Assessment Now ➔
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
