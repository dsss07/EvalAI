import { useState, useEffect, useMemo } from "react";
import api from "../api/client";
import type { Submission, Question } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentUsn?: string;
  studentBranch?: string;
  submissions: Submission[];
  questions: Question[];
  onSubmissionsUpdated?: (updatedSubs: Submission[]) => void;
}

export default function StudentSubmissionModal({
  isOpen,
  onClose,
  studentName,
  studentUsn,
  studentBranch,
  submissions,
  questions,
  onSubmissionsUpdated,
}: Props) {
  const [localSubs, setLocalSubs] = useState<Submission[]>(submissions);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState({ score: "", remarks: "" });
  const [editingOcrSubId, setEditingOcrSubId] = useState<string | null>(null);
  const [ocrInput, setOcrInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    setLocalSubs(submissions);
  }, [submissions]);

  // Unique uploaded images/documents
  const images = useMemo(() => {
    const list: string[] = [];
    localSubs.forEach((s) => {
      if (s.image_url && !list.includes(s.image_url)) {
        list.push(s.image_url);
      }
    });
    return list;
  }, [localSubs]);

  // Total scores
  const { totalAwarded, totalMax } = useMemo(() => {
    let awarded = 0;
    let max = 0;
    localSubs.forEach((s) => {
      const q = questions.find((item) => item.id === s.question_id);
      const qMax = q ? q.max_marks : 10;
      max += qMax;

      const teacherGrade = s.grades?.find(
        (g) => String(g.grader_type).toLowerCase() === "teacher"
      );
      const aiGrade = s.grades?.find(
        (g) => String(g.grader_type).toLowerCase() === "ai"
      );

      if (teacherGrade) {
        awarded += teacherGrade.score;
      } else if (aiGrade) {
        awarded += aiGrade.score;
      }
    });
    return { totalAwarded: awarded, totalMax: max };
  }, [localSubs, questions]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentImageUrl = images[selectedImageIndex] || null;

  // Grade submission
  const handleSaveGrade = async (subId: string) => {
    const score = parseFloat(gradeInput.score);
    if (isNaN(score)) return;

    setActionLoading(true);
    try {
      const { data: newGrade } = await api.post(
        `/api/submissions/${subId}/grade`,
        {
          score,
          remarks: gradeInput.remarks,
        }
      );

      const updated = localSubs.map((s) =>
        s.id === subId ? { ...s, grades: [...(s.grades || []), newGrade] } : s
      );
      setLocalSubs(updated);
      onSubmissionsUpdated?.(updated);
      setGradingSubId(null);
      setGradeInput({ score: "", remarks: "" });
    } catch (err) {
      console.error("Failed to save grade:", err);
      alert("Failed to save grade. Please check your network and try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm / Re-grade OCR
  const handleConfirmOcr = async (subId: string) => {
    setActionLoading(true);
    try {
      const { data: updatedSub } = await api.post(
        `/api/submissions/${subId}/confirm-ocr`,
        {
          corrected_text: ocrInput,
        }
      );

      const updated = localSubs.map((s) =>
        s.id === subId ? { ...s, ...updatedSub } : s
      );
      setLocalSubs(updated);
      onSubmissionsUpdated?.(updated);
      setEditingOcrSubId(null);
    } catch (err) {
      console.error("Failed to update OCR text:", err);
      alert("Failed to update OCR text.");
    } finally {
      setActionLoading(false);
    }
  };

  // Finalize marks for this question
  const handleFinalize = async (subId: string) => {
    setActionLoading(true);
    try {
      const { data: updatedSub } = await api.post(
        `/api/submissions/${subId}/finalize`
      );

      const updated = localSubs.map((s) =>
        s.id === subId ? { ...s, ...updatedSub, is_final: true } : s
      );
      setLocalSubs(updated);
      onSubmissionsUpdated?.(updated);
    } catch (err) {
      console.error("Failed to finalize submission:", err);
      alert("Failed to finalize submission marks.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/75 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
              {studentName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {studentName}
                </h2>
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
                Answer Sheet Evaluation · {localSubs.length} Question Segment
                {localSubs.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Total Awarded
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {totalAwarded.toFixed(1)}{" "}
                <span className="text-slate-400 text-xs font-normal">
                  / {totalMax.toFixed(1)} Marks
                </span>
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors text-lg font-bold"
              title="Close modal (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Main Body (Split View) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden min-h-0">
          {/* Left Column: Uploaded Document / Script Viewer */}
          <div className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-100/70 dark:bg-slate-950/40 p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Uploaded Script
                </span>
                {images.length > 1 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    Page {selectedImageIndex + 1} of {images.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {images.length > 1 && (
                  <div className="flex items-center gap-1 mr-2">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                          selectedImageIndex === idx
                            ? "bg-blue-600 text-white"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        P{idx + 1}
                      </button>
                    ))}
                  </div>
                )}

                {currentImageUrl && (
                  <>
                    <button
                      onClick={() =>
                        setZoomLevel((z) => (z >= 2 ? 1 : z + 0.5))
                      }
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50"
                      title="Zoom script"
                    >
                      🔍 {zoomLevel}x
                    </button>
                    <a
                      href={currentImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:bg-slate-50 flex items-center gap-1"
                    >
                      <span>Open</span>
                      <span>↗</span>
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Document display frame */}
            <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-auto flex items-center justify-center p-2 relative">
              {currentImageUrl ? (
                currentImageUrl.endsWith(".pdf") ? (
                  <object
                    data={currentImageUrl}
                    type="application/pdf"
                    className="w-full h-full min-h-[400px]"
                  >
                    <div className="text-center p-6 text-slate-500 text-xs">
                      Inline PDF viewer not supported on this browser.{" "}
                      <a
                        href={currentImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline font-semibold"
                      >
                        Download PDF
                      </a>
                    </div>
                  </object>
                ) : (
                  <img
                    src={currentImageUrl}
                    alt="Answer Script"
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: "top center",
                      transition: "transform 0.2s ease-in-out",
                    }}
                    className="max-w-full max-h-full object-contain"
                  />
                )
              ) : (
                <div className="text-center p-8 text-slate-400 space-y-2">
                  <span className="text-3xl block">📝</span>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Text-only Answer Submission
                  </p>
                  <p className="text-xs">
                    This student submitted their answers directly without an attached scanned image.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Questions & Extracted Answer Segments */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Extracted Answers & Grading ({localSubs.length} Questions)
              </h3>
              <span className="text-[11px] text-slate-400">
                Edit text to trigger re-evaluation or enter teacher marks
              </span>
            </div>

            {localSubs.map((sub, i) => {
              const matchedQuestion = questions.find(
                (q) => q.id === sub.question_id
              );
              const orderNum = matchedQuestion ? matchedQuestion.order : i + 1;
              const maxMarks = matchedQuestion ? matchedQuestion.max_marks : 10;

              const aiGrade = sub.grades?.find(
                (g) => String(g.grader_type).toLowerCase() === "ai"
              );
              const teacherGrade = sub.grades?.find(
                (g) => String(g.grader_type).toLowerCase() === "teacher"
              );
              const breakdown = aiGrade?.breakdown as
                | Record<string, any>
                | undefined;

              const isNotAttempted =
                sub.answer_text === "[Not Attempted / Marker Not Found]";

              return (
                <div
                  key={sub.id}
                  className={`rounded-xl border p-4 transition-all space-y-3 ${
                    sub.needs_review
                      ? "bg-amber-50/40 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800"
                      : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {/* Question header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        Q{orderNum}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {matchedQuestion?.question_text ||
                          sub.question_text ||
                          `Question ${orderNum}`}
                      </span>
                    </div>

                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                      {maxMarks} Marks
                    </span>
                  </div>

                  {sub.needs_review && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/30 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium">
                      <span>⚠️</span>
                      <span>OCR marker flagged for faculty inspection.</span>
                    </div>
                  )}

                  {isNotAttempted && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-md font-medium">
                      Marker not detected in uploaded script.
                    </div>
                  )}

                  {/* Transcribed Text area */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Student's Transcribed Answer Text
                      </label>
                      {editingOcrSubId !== sub.id && (
                        <button
                          onClick={() => {
                            setEditingOcrSubId(sub.id);
                            setOcrInput(sub.answer_text || "");
                          }}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          ✏️ Edit OCR Text
                        </button>
                      )}
                    </div>

                    {editingOcrSubId === sub.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={4}
                          value={ocrInput}
                          onChange={(e) => setOcrInput(e.target.value)}
                          className="w-full p-2.5 text-xs font-mono bg-white dark:bg-slate-900 border border-blue-500 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingOcrSubId(null)}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleConfirmOcr(sub.id)}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            {actionLoading ? "Updating..." : "Save & Re-Grade"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg p-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                        {sub.answer_text || "No text extracted."}
                      </div>
                    )}
                  </div>

                  {/* Score Pills & Breakdown */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {aiGrade && (
                      <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-full text-xs">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          AI:
                        </span>
                        <span className="text-blue-900 dark:text-blue-200 font-bold">
                          {aiGrade.score} / {aiGrade.max_score}
                        </span>
                      </div>
                    )}

                    {teacherGrade && (
                      <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Teacher:
                        </span>
                        <span className="text-emerald-900 dark:text-emerald-200 font-bold">
                          {teacherGrade.score} / {teacherGrade.max_score}
                        </span>
                      </div>
                    )}

                    {sub.is_final && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold">
                        Finalized
                      </span>
                    )}
                  </div>

                  {/* AI Feedback / Missing concepts */}
                  {breakdown && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-[11px] space-y-1">
                      {breakdown.feedback && (
                        <p className="text-slate-700 dark:text-slate-300">
                          <strong className="text-slate-900 dark:text-white">
                            Feedback:
                          </strong>{" "}
                          {String(breakdown.feedback)}
                        </p>
                      )}
                      {Array.isArray(breakdown.missing_concepts) &&
                        breakdown.missing_concepts.length > 0 && (
                          <p className="text-amber-600 dark:text-amber-400">
                            <strong>Missing:</strong>{" "}
                            {breakdown.missing_concepts.join(", ")}
                          </p>
                        )}
                    </div>
                  )}

                  {/* Inline Teacher Grading Form */}
                  {gradingSubId === sub.id ? (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-end gap-2">
                      <div className="w-24">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Marks (Max {maxMarks})
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={maxMarks}
                          value={gradeInput.score}
                          onChange={(e) =>
                            setGradeInput((g) => ({
                              ...g,
                              score: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Remarks / Teacher Feedback
                        </label>
                        <input
                          type="text"
                          value={gradeInput.remarks}
                          onChange={(e) =>
                            setGradeInput((g) => ({
                              ...g,
                              remarks: e.target.value,
                            }))
                          }
                          placeholder="Optional remarks..."
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSaveGrade(sub.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setGradingSubId(null)}
                          className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setGradingSubId(sub.id);
                          setGradeInput({
                            score: teacherGrade
                              ? String(teacherGrade.score)
                              : aiGrade
                              ? String(aiGrade.score)
                              : "",
                            remarks: "",
                          });
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        {teacherGrade ? "✏️ Edit Faculty Grade" : "✍️ Assign Grade"}
                      </button>

                      {!sub.is_final && (aiGrade || teacherGrade) && (
                        <button
                          onClick={() => handleFinalize(sub.id)}
                          disabled={actionLoading}
                          className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                        >
                          📢 Finalize Question
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
