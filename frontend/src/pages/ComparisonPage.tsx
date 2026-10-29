import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

interface QuestionComparison {
  question_id: string;
  question_number?: number;
  question_text: string;
  max_marks: number;
  total_submissions: number;
  graded_by_both: number;
  avg_teacher_score: number;
  avg_ai_score: number;
  avg_difference: number;
  agreement_pct: number;
  bias: string;
}

interface ComparisonData {
  set_id: string;
  set_title: string;
  grading_mode: string;
  overall_agreement_pct: number;
  total_graded_by_both: number;
  per_question: QuestionComparison[];
  submissions_detail: Array<{
    submission_id: string;
    student_name: string;
    question_text: string;
    teacher_score: number;
    ai_score: number;
    max_score: number;
    difference: number;
  }>;
}

export default function ComparisonPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/api/question-sets/${id}/comparison`)
      .then(({ data }) => setData(data))
      .catch(() =>
        setError(
          "Failed to load comparison data. Make sure some submissions have been graded by both AI and a teacher."
        )
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-slate-500 gap-3 px-4 text-center">
        <span className="text-3xl">⚠️</span>
        <p className="text-rose-500 font-semibold">{error || "No data available"}</p>
        <Link to={`/sets/${id}`} className="text-sm text-blue-600 hover:underline">
          Return to Question Set
        </Link>
      </div>
    );
  }

  // Chart data
  const scoreChartData = data.per_question.map((q, i) => ({
    name: `Q${q.question_number || i + 1}`,
    Teacher: q.avg_teacher_score,
    AI: q.avg_ai_score,
  }));

  const biasChartData = data.per_question
    .map((q, i) => ({
      name: `Q${q.question_number || i + 1}`,
      difference: q.avg_difference,
      bias: q.bias,
    }))
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  const agreementColor =
    data.overall_agreement_pct >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : data.overall_agreement_pct >= 50
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";

  const biasCount = {
    over: data.per_question.filter((q) => q.bias === "over-grades").length,
    under: data.per_question.filter((q) => q.bias === "under-grades").length,
    agree: data.per_question.filter((q) => q.bias === "agrees").length,
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "#0F172A",
      border: "none",
      borderRadius: "12px",
      color: "#fff",
      fontSize: "12px",
    },
    labelStyle: { color: "#94A3B8" },
    itemStyle: { color: "#FFFFFF" },
  };

  const biasColors: Record<string, string> = {
    "over-grades": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
    "under-grades": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    agrees: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Dashboard
          </Link>
          <span>›</span>
          <Link
            to="/#assessments"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Assessments
          </Link>
          <span>›</span>
          <Link
            to={`/sets/${id}`}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-xs"
          >
            {data.set_title}
          </Link>
          <span>›</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            AI Comparison
          </span>
        </div>

        {/* Header Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-2 uppercase tracking-wider">
            Model Evaluation Benchmarks
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            AI vs Faculty Evaluation Comparison
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyzing {data.total_graded_by_both} answer script
            {data.total_graded_by_both !== 1 ? "s" : ""} scored by both Gemini AI and faculty.
          </p>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Overall Scoring Agreement
            </p>
            <p className={`text-3xl sm:text-4xl font-bold mt-2 ${agreementColor}`}>
              {data.overall_agreement_pct}%
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Evaluations within ±10% margin of question max marks.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Dual-Graded Submissions
            </p>
            <p className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mt-2">
              {data.total_graded_by_both}
            </p>
            <p className="text-xs text-slate-400 mt-1 capitalize">
              Active Mode: <strong className="text-slate-700 dark:text-slate-300">{data.grading_mode}</strong>
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              AI Bias Distribution
            </p>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-blue-600 dark:text-blue-400 text-base font-bold bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg">
                {biasCount.over} <span className="text-xs font-medium">Over</span>
              </span>
              <span className="text-amber-600 dark:text-amber-400 text-base font-bold bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
                {biasCount.under} <span className="text-xs font-medium">Under</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 text-base font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
                {biasCount.agree} <span className="text-xs font-medium">Agree</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Per-question calibration delta
            </p>
          </div>
        </div>

        {data.total_graded_by_both === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-16 text-center shadow-sm">
            <span className="text-4xl mb-3 block">📊</span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              No comparable submissions yet
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Grade some student submissions first. Comparison graphs populate once both AI and faculty have scored the same answers.
            </p>
          </div>
        ) : (
          <>
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Score Comparison */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  Average Scores by Question
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Faculty marks (emerald) vs Gemini AI marks (blue).
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={scoreChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      stroke="#94a3b8"
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey="Teacher" name="Faculty" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="AI" name="Gemini AI" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Bias Chart */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  AI Grading Bias (AI − Faculty)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Positive values indicate AI scored higher than faculty.
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={biasChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      stroke="#94a3b8"
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip {...tooltipStyle} />
                    <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="3 3" />
                    <Bar
                      dataKey="difference"
                      name="Score Delta (AI − Faculty)"
                      radius={[4, 4, 0, 0]}
                    >
                      {biasChartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={
                            entry.difference > 0
                              ? "#2563EB"
                              : entry.difference < 0
                              ? "#D97706"
                              : "#059669"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />{" "}
                    AI Generous (+Δ)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />{" "}
                    AI Stricter (−Δ)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />{" "}
                    Exact Match
                  </span>
                </div>
              </div>
            </div>

            {/* Per-Question Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Per-Question Calibration Breakdown
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Detailed question level agreement statistics and average variance.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">#</th>
                      <th className="px-6 py-3.5">Question Prompt</th>
                      <th className="px-6 py-3.5 text-right">Faculty Avg</th>
                      <th className="px-6 py-3.5 text-right">AI Avg</th>
                      <th className="px-6 py-3.5 text-right">Delta (Δ)</th>
                      <th className="px-6 py-3.5 text-right">Agreement</th>
                      <th className="px-6 py-3.5 text-center">Bias</th>
                      <th className="px-6 py-3.5 text-right">Count (n)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.per_question.map((q, i) => (
                      <tr
                        key={q.question_id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-semibold text-xs">
                          Q{q.question_number || i + 1}
                        </td>
                        <td className="px-6 py-4 text-slate-800 dark:text-slate-200 max-w-[220px] truncate font-medium">
                          {q.question_text}
                        </td>
                        <td className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                          {q.avg_teacher_score} / {q.max_marks}
                        </td>
                        <td className="px-6 py-4 text-right text-blue-600 dark:text-blue-400 font-bold">
                          {q.avg_ai_score} / {q.max_marks}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-bold text-xs ${
                            q.avg_difference > 0
                              ? "text-blue-600 dark:text-blue-400"
                              : q.avg_difference < 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-slate-400"
                          }`}
                        >
                          {q.avg_difference > 0 ? "+" : ""}
                          {q.avg_difference}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-200">
                          {q.agreement_pct}%
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full border capitalize font-semibold ${
                              biasColors[q.bias] || ""
                            }`}
                          >
                            {q.bias}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 text-xs font-mono">
                          {q.graded_by_both}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Individual Submissions Detail Table */}
            {data.submissions_detail.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Individual Answer Script Comparisons
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Granular breakdown of each student submission scored by both parties.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                      <tr>
                        <th className="px-6 py-3.5">Student</th>
                        <th className="px-6 py-3.5">Question Prompt</th>
                        <th className="px-6 py-3.5 text-right">Faculty Score</th>
                        <th className="px-6 py-3.5 text-right">AI Score</th>
                        <th className="px-6 py-3.5 text-right">Delta (Δ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.submissions_detail.map((s) => (
                        <tr
                          key={s.submission_id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-white">
                            {s.student_name}
                          </td>
                          <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300 max-w-[240px] truncate text-xs">
                            {s.question_text}
                          </td>
                          <td className="px-6 py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                            {s.teacher_score} / {s.max_score}
                          </td>
                          <td className="px-6 py-3.5 text-right text-blue-600 dark:text-blue-400 font-bold">
                            {s.ai_score} / {s.max_score}
                          </td>
                          <td
                            className={`px-6 py-3.5 text-right font-bold text-xs ${
                              s.difference > 0
                                ? "text-blue-600 dark:text-blue-400"
                                : s.difference < 0
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-400"
                            }`}
                          >
                            {s.difference > 0 ? "+" : ""}
                            {s.difference}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
