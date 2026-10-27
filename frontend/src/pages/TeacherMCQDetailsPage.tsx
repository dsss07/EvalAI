import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { apiCall } from "../api/client";

const AVATAR_BG_COLORS = [
  "bg-emerald-500",
  "bg-violet-600",
  "bg-blue-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-600",
];

function getAvatarBg(name: string) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

export default function TeacherMCQDetailsPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [graceMarkInput, setGraceMarkInput] = useState<Record<string, string>>({});
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const res = await apiCall(`/api/question-sets/${id}/mcq-analytics`, {
        method: "GET",
      });
      setData(res.data);
    } catch (err: any) {
      console.error(
        "fetchData failed:",
        err.response?.status,
        err.response?.data || err
      );
      setError(err.response?.data?.detail || "Failed to load MCQ assessment data.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (
      !window.confirm(
        "Are you sure you want to finalize and publish results? Students will be able to view their final scores."
      )
    ) {
      return;
    }
    try {
      await apiCall(`/api/question-sets/${id}/finalize`, { method: "POST" });
      setMessage("Results published successfully! Students can now view their marks.");
      fetchData();
      setTimeout(() => setMessage(""), 5000);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to finalize results.");
    }
  };

  const handleAwardGraceMark = async (qId: string) => {
    const marks = parseFloat(graceMarkInput[qId]);
    if (isNaN(marks) || marks <= 0) {
      alert("Please enter a valid grace mark value > 0.");
      return;
    }

    try {
      const res = await apiCall(
        `/api/question-sets/${id}/questions/${qId}/grace-marks`,
        {
          method: "POST",
          body: JSON.stringify({ grace_marks: marks }),
        }
      );

      setMessage(
        `Grace marks applied! ${res.data.students_updated_count} students who attempted this question received points.`
      );
      await fetchData();
      setGraceMarkInput((prev) => ({ ...prev, [qId]: "" }));
      setTimeout(() => setMessage(""), 5000);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to award grace marks.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-slate-500 gap-3">
        <span className="text-3xl">⚠️</span>
        <p className="text-rose-500 font-semibold">{error || "No data available."}</p>
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

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
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs sm:max-w-md">
            {data.title}
          </span>
        </div>

        {/* Header Info Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className={`text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${
                    data.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                      : data.status === "COMPLETED"
                      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                  }`}
                >
                  {data.status}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-semibold uppercase">
                  MCQ Test
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {data.title}
              </h1>
            </div>

            {data.status !== "COMPLETED" && (
              <button
                onClick={handleFinalize}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-semibold text-sm shadow-sm transition-all flex items-center gap-2 self-start sm:self-auto"
              >
                <span>📢</span>
                <span>Finalize & Publish Results</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Class / Cohort
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {data.branch} - Sem {data.semester} ({data.section})
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Questions
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {data.questions?.length || 0}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Duration
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {data.duration_minutes || "—"} Mins
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Submissions
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {data.total_submissions || 0}
              </p>
            </div>
          </div>
        </div>

        {message && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3.5 rounded-xl text-sm flex items-center justify-between shadow-sm">
            <span>✅ {message}</span>
            <button
              onClick={() => setMessage("")}
              className="text-emerald-700 dark:text-emerald-300 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Submissions Table Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Student Submissions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Completed turn-ins and automatically calculated score tallies.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {data.submissions?.length || 0} Submissions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5">USN</th>
                  <th className="px-6 py-3.5">Submitted At</th>
                  <th className="px-6 py-3.5 text-center">Score</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.submissions?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-slate-400 text-sm"
                    >
                      No student submissions yet.
                    </td>
                  </tr>
                ) : (
                  data.submissions?.map((sub: any) => {
                    const ratio = sub.total_score / (sub.max_score || 1);
                    const avatarBg = getAvatarBg(sub.name);
                    const initials = (sub.name || "S")
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <tr
                        key={sub.student_id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
                            >
                              {initials}
                            </div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {sub.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {sub.usn || "—"}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {sub.submitted_at
                            ? new Date(sub.submitted_at).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              ratio >= 0.8
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : ratio >= 0.5
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                            }`}
                          >
                            {sub.total_score} / {sub.max_score}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedStudent(sub)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            👁️ View Answers
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Questions Breakdown & Grace Marks */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Question Breakdown & Grace Marks
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review multiple choice keys and award reactive bonus or grace points if needed.
            </p>
          </div>

          <div className="space-y-4">
            {data.questions?.map((q: any, idx: number) => (
              <div
                key={q.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-6 border transition-all shadow-sm space-y-4 ${
                  q.is_grace_awarded
                    ? "border-purple-300 dark:border-purple-800"
                    : "border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white flex items-start gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{q.question_text}</span>
                  </h3>
                  {q.is_grace_awarded && (
                    <span className="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 self-start">
                      🎯 Grace Mark Awarded
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-8">
                  {Object.entries(q.options || {}).map(([key, val]) => {
                    const isCorrect = q.correct_option === key;
                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${
                          isCorrect
                            ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300 font-medium"
                            : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div>
                          <span className="font-bold mr-2 text-slate-400">
                            {key}:
                          </span>
                          <span>{val as string}</span>
                        </div>
                        {isCorrect && (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold ml-2">
                            ✓ Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Default Marks:{" "}
                    <span className="text-slate-900 dark:text-white font-bold">
                      {q.marks || 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="e.g. 1.0"
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs sm:text-sm text-center w-24 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={graceMarkInput[q.id] || ""}
                      onChange={(e) =>
                        setGraceMarkInput({
                          ...graceMarkInput,
                          [q.id]: e.target.value,
                        })
                      }
                    />
                    <button
                      onClick={() => handleAwardGraceMark(q.id)}
                      disabled={!graceMarkInput[q.id]}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>🎯</span>
                      <span>Award Grace Mark</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Student Response Inspection Modal */}
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedStudent.name}
                  </h2>
                  <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                    {selectedStudent.usn}
                  </p>
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Total Score</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedStudent.total_score} / {selectedStudent.max_score}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {selectedStudent.answers?.map((ans: any, idx: number) => (
                  <div
                    key={ans.question_id}
                    className="bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white flex-1">
                        <span className="text-blue-600 dark:text-blue-400 mr-2 font-bold">
                          {idx + 1}.
                        </span>
                        {ans.question_text}
                      </p>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                          ans.marks_awarded > 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}
                      >
                        {ans.marks_awarded > 0 ? "+" : ""}
                        {ans.marks_awarded} / {ans.max_marks}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pl-5">
                      {Object.entries(ans.options || {}).map(([key, val]) => (
                        <div
                          key={key}
                          className="text-slate-600 dark:text-slate-300"
                        >
                          <span className="font-bold text-slate-400 mr-1.5">
                            {key}:
                          </span>
                          {val as string}
                        </div>
                      ))}
                    </div>

                    <div className="pl-5 flex flex-wrap gap-3 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 mr-1.5">Student Selected:</span>
                        {ans.selected_option ? (
                          <span
                            className={
                              ans.is_correct
                                ? "text-emerald-600 font-bold"
                                : "text-rose-600 font-bold"
                            }
                          >
                            Option {ans.selected_option}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Skipped</span>
                        )}
                      </div>

                      <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 mr-1.5">Correct Key:</span>
                        <span className="text-emerald-600 font-bold">
                          Option {ans.correct_option}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
