import { useState, useEffect } from "react";
import api from "../api/client";
import type { Submission, Question } from "../types";

interface Props {
  studentName: string;
  studentUsn?: string;
  studentBranch?: string;
  imageUrl: string;
  submissions: Submission[];
  questions: Question[];
  onConfirm: (updatedSubs: Submission[]) => void;
  onGrade?: (updatedSub: Submission) => void;
}

export default function FullScriptReview({
  studentName,
  studentUsn,
  studentBranch,
  imageUrl,
  submissions,
  questions,
  onConfirm,
  onGrade,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState({ score: "", remarks: "" });
  const [segments, setSegments] = useState(
    submissions.map((sub) => ({
      submission_id: sub.id,
      question_id: sub.question_id,
      corrected_text: sub.answer_text || "",
      original_needs_review: sub.needs_review,
    }))
  );

  // Sync state if props change
  useEffect(() => {
    setSegments(
      submissions.map((sub) => ({
        submission_id: sub.id,
        question_id: sub.question_id,
        corrected_text: sub.answer_text || "",
        original_needs_review: sub.needs_review,
      }))
    );
  }, [submissions]);

  const updateSegment = (id: string, field: string, value: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.submission_id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleConfirmAll = async () => {
    setLoading(true);
    try {
      const payload = {
        segments: segments.map((segment) => ({
          submission_id: segment.submission_id,
          question_id: segment.question_id,
          corrected_text: segment.corrected_text,
        })),
      };
      const { data } = await api.post("/api/submissions/confirm-script", payload);
      onConfirm(data);
    } catch (err) {
      console.error("Failed to confirm script", err);
    } finally {
      setLoading(false);
    }
  };

  const submitGrade = async (submissionId: string) => {
    const score = parseFloat(gradeInput.score);
    if (isNaN(score)) return;
    try {
      const { data } = await api.post(
        `/api/submissions/${submissionId}/grade`,
        {
          score,
          remarks: gradeInput.remarks,
        }
      );
      if (onGrade) {
        const sub = submissions.find((s) => s.id === submissionId);
        if (sub) {
          onGrade({ ...sub, grades: [...sub.grades, data] });
        }
      }
      setGrading(null);
      setGradeInput({ score: "", remarks: "" });
    } catch (err) {
      console.error("Grade failed", err);
    }
  };

  const finalizeSubmission = async (submissionId: string) => {
    try {
      const { data } = await api.post(
        `/api/submissions/${submissionId}/finalize`
      );
      if (onGrade) {
        onGrade(data);
      }
    } catch (err) {
      console.error("Finalize failed", err);
    }
  };

  const API_BASE = "";
  const fullImageUrl = imageUrl.startsWith("http")
    ? imageUrl
    : `${API_BASE}${imageUrl}`;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm mb-8">
      {/* Script Header Bar */}
      <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Student: {studentName}
            </h3>
            {studentUsn && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                {studentUsn}
              </span>
            )}
            {studentBranch && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-semibold uppercase">
                {studentBranch}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Full Exam Script Scan & OCR Answer Segments
          </p>
        </div>

        <button
          onClick={handleConfirmAll}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 self-start sm:self-auto"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </>
          ) : submissions.some((s) => s.needs_review) ? (
            "Approve Corrections & Start Grading"
          ) : (
            "Save Corrections & Re-Grade All"
          )}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 p-4 h-[620px]">
        {/* Left: Scanned Document Viewer */}
        <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 relative h-full flex flex-col">
          {fullImageUrl.endsWith(".pdf") ? (
            <object
              data={fullImageUrl}
              type="application/pdf"
              className="w-full h-full flex-1"
            >
              <p className="text-center p-6 text-slate-500 dark:text-slate-400 text-xs">
                Your browser does not support inline PDFs.{" "}
                <a
                  href={imageUrl}
                  className="text-blue-600 underline font-semibold"
                  target="_blank"
                  rel="noreferrer"
                >
                  Download the PDF
                </a>
              </p>
            </object>
          ) : (
            <img
              src={fullImageUrl}
              alt="Student Script"
              className="w-full h-full object-contain p-2"
            />
          )}
        </div>

        {/* Right: Segments Review */}
        <div className="overflow-y-auto space-y-4 pr-1">
          {segments.map((seg) => {
            const isNotAttempted =
              seg.corrected_text === "[Not Attempted / Marker Not Found]";

            return (
              <div
                key={seg.submission_id}
                className={`p-4 rounded-xl border transition-all ${
                  seg.original_needs_review
                    ? "bg-amber-50/50 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800"
                    : "bg-slate-50/60 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="mb-3 flex justify-between items-start">
                  <div className="flex-1 mr-4">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Assigned Question
                    </label>
                    <select
                      value={seg.question_id}
                      onChange={(e) =>
                        updateSegment(
                          seg.submission_id,
                          "question_id",
                          e.target.value
                        )
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {questions.map((q, idx) => (
                        <option key={q.id} value={q.id}>
                          Q{q.order && q.order > 0 ? q.order : idx + 1}: {q.question_text.substring(0, 45)}...
                        </option>
                      ))}
                    </select>
                  </div>
                  {seg.original_needs_review && (
                    <span className="shrink-0 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-1 rounded-full">
                      Needs Review
                    </span>
                  )}
                </div>

                {isNotAttempted && (
                  <div className="mb-2 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-2.5 py-1 rounded-lg">
                    ⚠️ Not attempted / marker not detected
                  </div>
                )}

                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Transcribed Text (Editable)
                </label>
                <textarea
                  value={seg.corrected_text}
                  onChange={(e) =>
                    updateSegment(
                      seg.submission_id,
                      "corrected_text",
                      e.target.value
                    )
                  }
                  className="w-full h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono leading-relaxed"
                  placeholder="Review or correct the OCR text here..."
                />

                {/* Score Badges */}
                {(() => {
                  const sub = submissions.find(
                    (s) => s.id === seg.submission_id
                  );
                  if (!sub) return null;

                  const aiGrade = sub.grades?.find(
                    (g) => String(g.grader_type).toLowerCase() === "ai"
                  );
                  const teacherGrade = sub.grades?.find(
                    (g) => String(g.grader_type).toLowerCase() === "teacher"
                  );

                  return (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {aiGrade && (
                        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
                            AI Score:
                          </span>
                          <span className="text-xs text-blue-800 dark:text-blue-300 font-bold">
                            {aiGrade.score} / {aiGrade.max_score}
                          </span>
                        </div>
                      )}
                      {teacherGrade && (
                        <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                            Teacher:
                          </span>
                          <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                            {teacherGrade.score} / {teacherGrade.max_score}
                          </span>
                        </div>
                      )}
                      {!aiGrade &&
                        !teacherGrade &&
                        !seg.original_needs_review && (
                          <span className="text-[11px] text-slate-400 italic">
                            Not graded yet
                          </span>
                        )}
                      {sub.is_final && (
                        <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 rounded-full">
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">
                            Finalized
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Teacher Grade Form */}
                {(() => {
                  const sub = submissions.find(
                    (s) => s.id === seg.submission_id
                  );
                  if (!sub) return null;

                  const aiGrade = sub.grades?.find(
                    (g) => String(g.grader_type).toLowerCase() === "ai"
                  );
                  const teacherGrade = sub.grades?.find(
                    (g) => String(g.grader_type).toLowerCase() === "teacher"
                  );

                  return grading === sub.id ? (
                    <div className="flex flex-wrap items-end gap-2.5 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="w-24">
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Score
                        </label>
                        <input
                          type="number"
                          value={gradeInput.score}
                          onChange={(e) =>
                            setGradeInput((g) => ({
                              ...g,
                              score: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Remarks / Qualitative Feedback
                        </label>
                        <input
                          value={gradeInput.remarks}
                          onChange={(e) =>
                            setGradeInput((g) => ({
                              ...g,
                              remarks: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="Optional feedback..."
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => submitGrade(sub.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setGrading(null)}
                          className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setGrading(sub.id);
                          setGradeInput({ score: "", remarks: "" });
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        {teacherGrade ? "✏️ Re-grade" : "✍️ Grade this answer"}
                      </button>

                      {!sub.is_final && (aiGrade || teacherGrade) && (
                        <button
                          onClick={() => finalizeSubmission(sub.id)}
                          className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                        >
                          📢 Finalize Marks
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
