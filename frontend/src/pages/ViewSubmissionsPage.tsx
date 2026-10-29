import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import type { Submission, QuestionSetDetail } from "../types";
import StudentSubmissionModal from "../components/StudentSubmissionModal";

interface StudentGroup {
  studentId: string;
  studentName: string;
  studentUsn?: string;
  studentBranch?: string;
  submittedAt: string;
  submissions: Submission[];
  totalScore: number;
  maxScore: number;
  status: "NEEDS_REVIEW" | "FINALIZED" | "GRADED" | "PENDING";
}

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

function getTeacherGrade(grades?: any[]) {
  if (!grades || grades.length === 0) return undefined;
  const teacherGrades = grades.filter(
    (g) => String(g.grader_type).toLowerCase() === "teacher"
  );
  if (teacherGrades.length === 0) return undefined;
  return [...teacherGrades].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  )[0];
}

function getAiGrade(grades?: any[]) {
  if (!grades || grades.length === 0) return undefined;
  const aiGrades = grades.filter(
    (g) => String(g.grader_type).toLowerCase() === "ai"
  );
  if (aiGrades.length === 0) return undefined;
  return [...aiGrades].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  )[0];
}

const roundToHalf = (v: number) => Math.round(v * 2) / 2;

export default function ViewSubmissionsPage() {
  const { id: setId } = useParams<{ id: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [questionSet, setQuestionSet] = useState<QuestionSetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentGroup | null>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/api/submissions?set_id=${setId}`),
      api.get(`/api/question-sets/${setId}`),
    ])
      .then(([subsRes, qsRes]) => {
        const subsData = Array.isArray(subsRes.data)
          ? subsRes.data
          : Array.isArray(subsRes.data?.content)
          ? subsRes.data.content
          : [];

        const qsData = qsRes.data?.set
          ? {
              ...qsRes.data.set,
              questions:
                qsRes.data.questions ?? qsRes.data.set.questions ?? [],
            }
          : qsRes.data;

        setSubmissions(
          subsData.map((item: any) => {
            const sub = item.submission
              ? {
                  ...item.submission,
                  student_name: item.student_name,
                  student_usn: item.student_usn,
                  student_branch: item.student_branch,
                  question_text: item.question_text,
                }
              : item;

            return {
              ...sub,
              grades: Array.isArray(sub.grades) ? sub.grades : [],
            } as Submission;
          })
        );
        setQuestionSet(qsData);
        setLoadError(null);
      })
      .catch((err) => {
        console.error("Failed to load submissions", err);
        setLoadError(
          err?.response?.data?.message ||
            err?.message ||
            "Could not load submissions. Please ensure you are logged in as a faculty member."
        );
      })
      .finally(() => setLoading(false));
  }, [setId]);

  // Group submissions row-wise by Student
  const studentGroups: StudentGroup[] = useMemo(() => {
    const map = new Map<string, Submission[]>();

    submissions.forEach((sub) => {
      const key = sub.student_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(sub);
    });

    const groups: StudentGroup[] = [];

    map.forEach((subs, studentId) => {
      const first = subs[0];
      const studentName = first.student_name || "Unknown Student";
      const studentUsn = first.student_usn || "";
      const studentBranch = first.student_branch || "";

      let totalScore = 0;
      let maxScore = 0;
      let hasNeedsReview = false;
      let allFinal = true;
      let allGraded = true;

      subs.forEach((s) => {
        if (s.needs_review) hasNeedsReview = true;
        if (!s.is_final) allFinal = false;

        const teacherGrade = getTeacherGrade(s.grades);
        const aiGrade = getAiGrade(s.grades);

        if (teacherGrade) {
          totalScore += roundToHalf(teacherGrade.score);
        } else if (aiGrade) {
          totalScore += roundToHalf(aiGrade.score);
        } else {
          allGraded = false;
        }

        const q = questionSet?.questions?.find((item) => item.id === s.question_id);
        maxScore += q ? q.max_marks : 10;
      });

      let status: StudentGroup["status"] = "PENDING";
      if (hasNeedsReview) {
        status = "NEEDS_REVIEW";
      } else if (allFinal && subs.length > 0) {
        status = "FINALIZED";
      } else if (allGraded && subs.length > 0) {
        status = "GRADED";
      }

      // Latest submission time
      const latestTimestamp = subs.reduce((latest, current) => {
        return new Date(current.submitted_at) > new Date(latest)
          ? current.submitted_at
          : latest;
      }, first.submitted_at);

      groups.push({
        studentId,
        studentName,
        studentUsn,
        studentBranch,
        submittedAt: latestTimestamp,
        submissions: subs,
        totalScore,
        maxScore,
        status,
      });
    });

    // Sort by most recent submission first
    return groups.sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }, [submissions, questionSet]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return studentGroups;
    const query = searchQuery.toLowerCase();
    return studentGroups.filter(
      (g) =>
        g.studentName.toLowerCase().includes(query) ||
        (g.studentUsn && g.studentUsn.toLowerCase().includes(query)) ||
        (g.studentBranch && g.studentBranch.toLowerCase().includes(query))
    );
  }, [studentGroups, searchQuery]);

  // Update submissions in parent state after modal actions
  const handleSubmissionsUpdated = (updatedSubs: Submission[]) => {
    const updatedIds = updatedSubs.map((s) => s.id);
    setSubmissions((prev) => [
      ...prev.filter((s) => !updatedIds.includes(s.id)),
      ...updatedSubs,
    ]);

    // Keep active selected student updated
    if (selectedStudent) {
      setSelectedStudent((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          submissions: updatedSubs,
        };
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
          {questionSet && (
            <>
              <Link
                to={`/sets/${setId}`}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-xs"
              >
                {questionSet.title}
              </Link>
              <span>›</span>
            </>
          )}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Submissions
          </span>
        </div>

        {/* Page Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-2 uppercase tracking-wider">
              Submissions Overview
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Student Submissions
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Select any student row below to inspect their uploaded script, mapped answers, and assign final grades.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {studentGroups.length} Students Submitted
            </span>
          </div>
        </div>

        {loadError && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 p-4 rounded-xl text-sm flex items-start justify-between">
            <div>
              <p className="font-semibold">Unable to load submissions</p>
              <p className="mt-1 text-xs">{loadError}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-bold bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-rose-300 hover:bg-rose-50"
            >
              Retry
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <span className="text-slate-400 text-lg">🔍</span>
          <input
            type="text"
            placeholder="Search by student name, USN, or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Row-wise Student Submissions Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">#</th>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5">USN</th>
                  <th className="px-6 py-3.5">Class</th>
                  <th className="px-6 py-3.5">Submission Time</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Awarded Score</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredGroups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-slate-400 text-sm"
                    >
                      {studentGroups.length === 0
                        ? "No student submissions recorded yet."
                        : "No submissions matched your search criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((group, index) => {
                    const avatarBg = getAvatarBg(group.studentName);
                    const initials = group.studentName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <tr
                        key={group.studentId}
                        onClick={() => setSelectedStudent(group)}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4 text-xs font-semibold text-slate-400">
                          {index + 1}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
                            >
                              {initials}
                            </div>
                            <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {group.studentName}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {group.studentUsn || "—"}
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-xs px-2.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase">
                            {group.studentBranch || "—"}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                          {group.submittedAt
                            ? new Date(group.submittedAt).toLocaleDateString(
                                "en-US",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "—"}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              group.status === "NEEDS_REVIEW"
                                ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                : group.status === "FINALIZED"
                                ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                : group.status === "GRADED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                            }`}
                          >
                            {group.status === "NEEDS_REVIEW"
                              ? "Needs Review"
                              : group.status === "FINALIZED"
                              ? "Finalized"
                              : group.status === "GRADED"
                              ? "Graded"
                              : "Pending"}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {group.totalScore.toFixed(1)}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {" "}
                            / {group.maxScore.toFixed(1)}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudent(group);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all flex items-center gap-1.5 ml-auto"
                          >
                            <span>Review Script</span>
                            <span>➔</span>
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
      </div>

      {/* Student Submission Detail Modal */}
      {selectedStudent && questionSet && (
        <StudentSubmissionModal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          studentName={selectedStudent.studentName}
          studentUsn={selectedStudent.studentUsn}
          studentBranch={selectedStudent.studentBranch}
          submissions={selectedStudent.submissions}
          questions={questionSet.questions}
          onSubmissionsUpdated={handleSubmissionsUpdated}
        />
      )}
    </div>
  );
}
