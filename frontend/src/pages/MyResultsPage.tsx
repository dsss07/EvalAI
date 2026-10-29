import { useEffect, useState, useMemo } from "react";
import api from "../api/client";
import type { MyResult, EvaluationReport } from "../types";
import { Link } from "react-router-dom";

export default function MyResultsPage() {
  const [results, setResults] = useState<MyResult[]>([]);
  const [reports, setReports] = useState<EvaluationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMcqResult, setSelectedMcqResult] = useState<MyResult | null>(null);
  const [selectedDescriptiveResult, setSelectedDescriptiveResult] = useState<MyResult | null>(null);

  // Discrepancy reporting state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportingResult, setReportingResult] = useState<MyResult | null>(null);
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"ALL" | "DESCRIPTIVE" | "MCQ">("ALL");

  const loadReports = () => {
    api
      .get("/api/reports/student")
      .then(({ data }) => setReports(data))
      .catch((err) => console.error("Failed to load discrepancy reports", err));
  };

  useEffect(() => {
    api
      .get("/api/question-sets/student/results")
      .then(({ data }) => setResults(data))
      .catch((err) => console.error("Failed to load results", err))
      .finally(() => setLoading(false));

    loadReports();
  }, []);

  const getReportForSet = (setId: string) => {
    return (
      reports.find((r) => (r.setId === setId || r.set_id === setId) && r.status === "PENDING") ||
      reports.find((r) => r.setId === setId || r.set_id === setId)
    );
  };

  const getReportForQuestion = (setId: string, questionNumber: number) => {
    return (
      reports.find(
        (r) =>
          (r.setId === setId || r.set_id === setId) &&
          (r.questionNumber ?? r.question_number) === questionNumber &&
          r.status === "PENDING"
      ) ||
      reports.find(
        (r) =>
          (r.setId === setId || r.set_id === setId) &&
          (r.questionNumber ?? r.question_number) === questionNumber
      )
    );
  };

  const openReportModal = (result: MyResult, questionNumber: number | null = null) => {
    setReportingResult(result);
    setSelectedQuestionNumber(questionNumber);
    setReportReason("");
    setReportMessage(null);
    setReportModalOpen(true);
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingResult || !reportReason.trim()) return;

    setSubmittingReport(true);
    setReportMessage(null);
    try {
      await api.post("/api/reports", {
        setId: reportingResult.set_id,
        set_id: reportingResult.set_id,
        questionNumber: selectedQuestionNumber,
        question_number: selectedQuestionNumber,
        reason: reportReason.trim(),
      });
      setReportMessage({
        type: "success",
        text: "Discrepancy report submitted successfully! Your instructor has been notified.",
      });
      loadReports();
      setTimeout(() => {
        setReportModalOpen(false);
        setReportMessage(null);
      }, 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to submit discrepancy report. Please try again.";
      setReportMessage({ type: "error", text: msg });
    } finally {
      setSubmittingReport(false);
    }
  };

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const matchesSearch =
        (r.set_title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.subject || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        selectedType === "ALL" || r.test_type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [results, searchQuery, selectedType]);

  // Overall statistics
  const stats = useMemo(() => {
    if (!results.length) {
      return { totalTests: 0, avgPercentage: 0, highestPercentage: 0, totalMarks: 0, maxPossibleMarks: 0 };
    }
    let totalScore = 0;
    let maxScore = 0;
    let highestPct = 0;

    results.forEach((r) => {
      totalScore += r.total_score || 0;
      maxScore += r.max_score || 0;
      const pct = r.max_score > 0 ? (r.total_score / r.max_score) * 100 : 0;
      if (pct > highestPct) highestPct = pct;
    });

    const avgPercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    return {
      totalTests: results.length,
      avgPercentage,
      highestPercentage: Math.round(highestPct),
      totalMarks: totalScore,
      maxPossibleMarks: maxScore,
    };
  }, [results]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-32">
      {/* Header Banner */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                Academic Transcript & Review
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              My Examination Results
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 max-w-2xl">
              Access your finalized marks, question-by-question scoring breakdowns, and
              AI-generated diagnostic feedback for your submitted assessments.
            </p>
          </div>
          <Link
            to="/"
            className="self-start md:self-auto px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
          >
            <span>←</span> Back to Dashboard
          </Link>
        </div>
      </div>

      {/* KPI Performance Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Evaluated Tests
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              {stats.totalTests}
            </span>
            <span className="text-xs text-slate-400 font-medium">completed</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Overall Average
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
              {stats.avgPercentage}%
            </span>
            <span className="text-xs text-slate-400 font-medium">aggregate</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Highest Score
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.highestPercentage}%
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">top mark</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Total Points
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              {stats.totalMarks}
            </span>
            <span className="text-xs text-slate-400 font-medium">/ {stats.maxPossibleMarks}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setSelectedType("ALL")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 sm:flex-none ${
              selectedType === "ALL"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All ({results.length})
          </button>
          <button
            onClick={() => setSelectedType("DESCRIPTIVE")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 sm:flex-none ${
              selectedType === "DESCRIPTIVE"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Descriptive
          </button>
          <button
            onClick={() => setSelectedType("MCQ")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 sm:flex-none ${
              selectedType === "MCQ"
                ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            MCQs
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or subject..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <span className="absolute left-3 top-2.5 text-slate-400 text-xs">
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <span className="text-4xl mb-3 block">🎓</span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {searchQuery ? "No matching results found" : "No finalized results yet"}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
            {searchQuery
              ? "Try adjusting your search criteria or filter to locate other examination evaluations."
              : "Once your teachers finalize evaluation of your answer scripts, your grades and AI feedback will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredResults.map((r) => {
            const pct = r.max_score > 0 ? Math.round((r.total_score / r.max_score) * 100) : 0;
            const isDescriptive = r.test_type !== "MCQ";

            // Status color based on score
            let pctColor = "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60";
            let progressBg = "bg-rose-500";
            if (pct >= 75) {
              pctColor = "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60";
              progressBg = "bg-emerald-500";
            } else if (pct >= 50) {
              pctColor = "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60";
              progressBg = "bg-blue-500";
            } else if (pct >= 35) {
              pctColor = "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60";
              progressBg = "bg-amber-500";
            }

            return (
              <div
                key={r.set_id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-6 transition-all border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md flex flex-col justify-between relative overflow-hidden ${
                  isDescriptive ? "border-l-4 border-l-blue-600" : "border-l-4 border-l-purple-600"
                }`}
              >
                <div>
                  {/* Top Tags */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isDescriptive ? (
                        <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Descriptive Script
                        </span>
                      ) : (
                        <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          MCQ Assessment
                        </span>
                      )}

                      {r.subject && (
                        <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                          📚 {r.subject}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {(() => {
                        const rep = getReportForSet(r.set_id);
                        if (!rep) return null;
                        if (rep.status === "PENDING") {
                          return (
                            <span className="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                              <span>🚩</span> Recheck Requested
                            </span>
                          );
                        }
                        if (rep.status === "RESOLVED") {
                          return (
                            <span className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                              <span>✓</span> Rechecked
                            </span>
                          );
                        }
                        return null;
                      })()}
                      <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                        <span>✓</span> Finalized
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-snug mb-4">
                    {r.set_title}
                  </h3>

                  {/* Score & Progress Section */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800 mb-5">
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          Final Evaluated Score
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                            {Math.round(r.total_score * 2) / 2}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            / {r.max_score} marks
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${pctColor}`}
                      >
                        {pct}% Score
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${progressBg}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400">
                    {isDescriptive
                      ? `${r.descriptive_answers?.length || 0} questions graded`
                      : `${r.mcq_answers?.length || 0} questions graded`}
                  </span>

                  {r.test_type === "MCQ" ? (
                    <button
                      onClick={() => setSelectedMcqResult(r)}
                      className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-sm shadow-purple-500/20 flex items-center gap-1.5"
                    >
                      <span>View Breakdown</span>
                      <span>➔</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedDescriptiveResult(r)}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-sm shadow-blue-500/20 flex items-center gap-1.5"
                      >
                        <span>View AI Breakdown</span>
                        <span>➔</span>
                      </button>
                      <Link
                        to={`/sets/${r.set_id}`}
                        className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl font-medium transition-colors"
                        title="View Assessment Details"
                      >
                        Set Info
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MCQ Detail Modal */}
      {selectedMcqResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900/70">
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    MCQ Breakdown
                  </span>
                  {selectedMcqResult.subject && (
                    <span className="text-xs bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
                      📚 {selectedMcqResult.subject}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  {selectedMcqResult.set_title}
                </h2>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right hidden sm:block bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 px-3.5 py-1.5 rounded-xl">
                  <p className="text-[10px] text-purple-700 dark:text-purple-300 font-bold uppercase tracking-wider">
                    Final Score
                  </p>
                  <p className="text-lg font-extrabold text-purple-900 dark:text-purple-100">
                    {selectedMcqResult.total_score}
                    <span className="text-xs text-purple-500 font-medium">
                      {" "}/ {selectedMcqResult.max_score}
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => setSelectedMcqResult(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 w-9 h-9 rounded-xl flex items-center justify-center transition-colors text-sm font-bold"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable Questions */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/40 dark:bg-slate-950/40">
              {selectedMcqResult.mcq_answers?.map((ans, idx) => (
                <div
                  key={ans.question_id}
                  className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border transition-all ${
                    ans.is_grace_awarded
                      ? "border-purple-300 dark:border-purple-800 shadow-sm"
                      : "border-slate-200/80 dark:border-slate-800"
                  }`}
                >
                  <div className="flex justify-between items-start mb-4 gap-3">
                    <p className="text-slate-900 dark:text-white font-medium flex-1 text-base leading-relaxed">
                      <span className="text-purple-600 dark:text-purple-400 font-bold mr-2">
                        {idx + 1}.
                      </span>
                      {ans.question_text}
                    </p>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                          ans.marks_awarded > 0
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                        }`}
                      >
                        {ans.marks_awarded > 0 ? "+" : ""}
                        {ans.marks_awarded} / {ans.max_marks} marks
                      </div>
                      {ans.is_grace_awarded && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 font-bold uppercase">
                          🎯 Grace Mark
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
                    {Object.entries(ans.options || {}).map(([key, val]) => {
                      const isSelected = ans.selected_option === key;
                      const isCorrect = ans.correct_option === key;

                      let optionClass =
                        "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300";
                      let tag = null;

                      if (isCorrect && isSelected) {
                        optionClass =
                          "bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-semibold";
                        tag = (
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold ml-2">
                            ✓ Your Correct Answer
                          </span>
                        );
                      } else if (isCorrect) {
                        optionClass =
                          "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-medium";
                        tag = (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium ml-2">
                            ✓ Correct Option
                          </span>
                        );
                      } else if (isSelected && !isCorrect) {
                        optionClass =
                          "bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-medium";
                        tag = (
                          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium ml-2">
                            ✗ Your Answer
                          </span>
                        );
                      }

                      return (
                        <div
                          key={key}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs ${optionClass}`}
                        >
                          <div>
                            <span className="font-bold mr-2 text-slate-500 dark:text-slate-400">
                              {key}:
                            </span>
                            <span>{val as string}</span>
                          </div>
                          {tag}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                      Selected:{" "}
                      <strong className={ans.is_correct ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {ans.selected_option ? `Option ${ans.selected_option}` : "Skipped"}
                      </strong>
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                      Correct Key:{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        Option {ans.correct_option}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}

              {(!selectedMcqResult.mcq_answers || selectedMcqResult.mcq_answers.length === 0) && (
                <div className="text-center text-slate-500 dark:text-slate-400 py-10">
                  No individual question records available for this assessment.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Descriptive Detail Modal */}
      {selectedDescriptiveResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900/70">
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Descriptive Evaluation & Feedback
                  </span>
                  {selectedDescriptiveResult.subject && (
                    <span className="text-xs bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
                      📚 {selectedDescriptiveResult.subject}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  {selectedDescriptiveResult.set_title}
                </h2>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => openReportModal(selectedDescriptiveResult)}
                  className="px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Report Discrepancy / Request Re-evaluation"
                >
                  <span>🚩</span>
                  <span className="hidden sm:inline">Report Discrepancy</span>
                </button>

                <div className="text-right hidden sm:block bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 px-3.5 py-1.5 rounded-xl">
                  <p className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">
                    Total Score
                  </p>
                  <p className="text-lg font-extrabold text-blue-900 dark:text-blue-100">
                    {Math.round(selectedDescriptiveResult.total_score * 2) / 2}
                    <span className="text-xs text-blue-500 font-medium">
                      {" "}/ {selectedDescriptiveResult.max_score}
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => setSelectedDescriptiveResult(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 w-9 h-9 rounded-xl flex items-center justify-center transition-colors text-sm font-bold"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable Answers */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/40 dark:bg-slate-950/40">
              {selectedDescriptiveResult.descriptive_answers?.map((ans) => {
                const pct = ans.max_marks > 0 ? (ans.score_awarded / ans.max_marks) * 100 : 0;
                let badgeClass = "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
                if (pct >= 75) {
                  badgeClass = "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                } else if (pct >= 40) {
                  badgeClass = "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                }

                return (
                  <div
                    key={ans.question_id}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4"
                  >
                    {/* Question Header & Marks */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                            Question #{ans.question_number}
                          </span>
                        </div>
                        <h4 className="text-slate-900 dark:text-white font-medium text-base leading-snug">
                          {ans.question_text}
                        </h4>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold border shrink-0 ${badgeClass}`}>
                        {Math.round(ans.score_awarded * 2) / 2} / {ans.max_marks} Marks
                      </div>
                    </div>

                    {/* Student Submitted Answer */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          ✍️ Your Submitted / Extracted Answer
                        </span>
                        {ans.image_url && (
                          <a
                            href={ans.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline lowercase tracking-normal flex items-center gap-1 font-medium"
                          >
                            <span>📎</span> View Script Image
                          </a>
                        )}
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 text-xs md:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                        {ans.student_answer ? (
                          ans.student_answer
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">
                            No answer recorded for this question.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Feedback & Diagnostic Remarks */}
                    <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        <span className="text-sm">✨</span>
                        <span>AI Diagnostic Evaluation & Feedback</span>
                      </div>
                      <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {ans.ai_feedback || "Evaluation completed."}
                      </p>

                      {ans.missing_concepts && ans.missing_concepts.length > 0 && (
                        <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                            <span>⚠️</span> Key Missing Concepts / Areas for Improvement:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ans.missing_concepts.map((concept, cIdx) => (
                              <span
                                key={cIdx}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-medium"
                              >
                                <span>•</span>
                                {concept}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Teacher Remarks if available */}
                    {ans.teacher_remarks && ans.teacher_remarks.trim() !== "" && (
                      <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/40 rounded-xl p-4 space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                          <span>👨‍🏫</span> Faculty Review Remarks
                        </p>
                        <p className="text-xs md:text-sm text-purple-900 dark:text-purple-200">
                          {ans.teacher_remarks}
                        </p>
                      </div>
                    )}

                    {/* Discrepancy reporting on question level */}
                    {(() => {
                      const qReport = getReportForQuestion(
                        selectedDescriptiveResult.set_id,
                        ans.question_number
                      );
                      if (qReport && qReport.status === "PENDING") {
                        return (
                          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start justify-between gap-2 text-xs">
                            <div className="space-y-0.5">
                              <span className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1">
                                <span>🚩</span> Discrepancy Reported:
                              </span>
                              <p className="text-amber-700 dark:text-amber-300">
                                {qReport.reason}
                              </p>
                            </div>
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                              Awaiting Faculty Review
                            </span>
                          </div>
                        );
                      }
                      if (qReport && qReport.status === "RESOLVED") {
                        return (
                          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3 flex items-start justify-between gap-2 text-xs">
                            <div className="space-y-0.5">
                              <span className="font-bold text-purple-800 dark:text-purple-200 flex items-center gap-1">
                                <span>✓</span> Re-evaluation Completed:
                              </span>
                              <p className="text-purple-700 dark:text-purple-300">
                                {qReport.resolutionRemarks ||
                                  qReport.resolution_remarks ||
                                  "Instructor reviewed and resolved this question."}
                              </p>
                            </div>
                            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                              Resolved
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              openReportModal(selectedDescriptiveResult, ans.question_number)
                            }
                            className="text-xs text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 font-medium flex items-center gap-1 transition-colors"
                          >
                            <span>🚩</span> Flag question discrepancy
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              {(!selectedDescriptiveResult.descriptive_answers ||
                selectedDescriptiveResult.descriptive_answers.length === 0) && (
                <div className="text-center text-slate-500 dark:text-slate-400 py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-3xl block mb-2">📋</span>
                  No individual question breakdown found for this assessment.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Reporting Modal */}
      {reportModalOpen && reportingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300">
                  🚩
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Request Re-evaluation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                    {reportingResult.set_title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitReport} className="p-6 space-y-4">
              {reportMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium border ${
                    reportMessage.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
                  }`}
                >
                  {reportMessage.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Target Question / Scope
                </label>
                <select
                  value={selectedQuestionNumber === null ? "OVERALL" : selectedQuestionNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedQuestionNumber(val === "OVERALL" ? null : Number(val));
                  }}
                  className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  <option value="OVERALL">Overall Assessment / Multiple Questions</option>
                  {reportingResult.descriptive_answers?.map((ans) => (
                    <option key={ans.question_id} value={ans.question_number}>
                      Question #{ans.question_number}: {ans.question_text.slice(0, 45)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Reason / Discrepancy Details
                </label>
                <textarea
                  required
                  rows={4}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Explain what was misgraded or missed by OCR (e.g., 'In step 2, handwritten formula was parsed incorrectly and marks deducted...')"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none leading-relaxed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Your instructor will review this report alongside your original uploaded script.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport || !reportReason.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white transition-all shadow-sm flex items-center gap-1.5"
                >
                  {submittingReport ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Report</span>
                      <span>➔</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
