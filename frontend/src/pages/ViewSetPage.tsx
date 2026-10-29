import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import type { QuestionSetDetail, Submission } from "../types";
import { formatDateTime } from "../utils/dateUtils";
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

export default function ViewSetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [set, setSet] = useState<QuestionSetDetail | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuestionSet, setShowQuestionSet] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentGroup | null>(null);

  const fetchData = async () => {
    try {
      const [qsRes, subsRes] = await Promise.all([
        api.get(`/api/question-sets/${id}`),
        user?.role === "teacher"
          ? api.get(`/api/submissions?set_id=${id}`).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      const qsData = qsRes.data;
      const setDetail = qsData.set
        ? {
            ...qsData.set,
            teacher_name: qsData.teacher_name || qsData.teacherName,
            questions: qsData.questions || [],
          }
        : qsData;
      setSet(setDetail);

      if (subsRes && subsRes.data) {
        const subsData = Array.isArray(subsRes.data)
          ? subsRes.data
          : Array.isArray(subsRes.data?.content)
          ? subsRes.data.content
          : [];

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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, user]);

  // Aggregate submissions row-wise by Student
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

        const teacherGrade = s.grades?.find(
          (g) => String(g.grader_type).toLowerCase() === "teacher"
        );
        const aiGrade = s.grades?.find(
          (g) => String(g.grader_type).toLowerCase() === "ai"
        );

        if (teacherGrade) {
          totalScore += teacherGrade.score;
        } else if (aiGrade) {
          totalScore += aiGrade.score;
        } else {
          allGraded = false;
        }

        const q = set?.questions?.find((item) => item.id === s.question_id);
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

    return groups.sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }, [submissions, set]);

  // Handle submissions updated in modal
  const handleSubmissionsUpdated = (updatedSubs: Submission[]) => {
    const updatedIds = updatedSubs.map((s) => s.id);
    setSubmissions((prev) => [
      ...prev.filter((s) => !updatedIds.includes(s.id)),
      ...updatedSubs,
    ]);

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

  const handleDelete = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this question set? This action cannot be undone and will delete all associated questions, submissions, and grades."
      )
    ) {
      try {
        await api.delete(`/api/question-sets/${id}`);
        navigate("/");
      } catch (err) {
        alert("Failed to delete the question set.");
      }
    }
  };

  const handleFinalizeAll = async () => {
    if (
      window.confirm(
        "Are you sure you want to finalize all submissions for this question set? Once finalized, students will be able to see their marks."
      )
    ) {
      try {
        await api.post(`/api/question-sets/${id}/finalize-all`);
        await fetchData();
      } catch (err) {
        alert("Failed to finalize submissions.");
      }
    }
  };

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
        <span className="text-3xl">🔍</span>
        <p className="text-base font-semibold">Question set not found.</p>
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Calculate Open / Closed timing status
  const now = new Date();
  const startTime = set.start_time ? new Date(set.start_time) : null;
  const endTime = set.end_time ? new Date(set.end_time) : null;
  const graceMinutes = set.grace_period_minutes || 0;
  const deadlineWithGrace = endTime
    ? new Date(endTime.getTime() + graceMinutes * 60000)
    : null;

  let assessmentStatus: "OPEN" | "CLOSED" | "SCHEDULED" = "OPEN";
  let statusBadgeText = "Open / Active";
  let statusBadgeClass =
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
  let statusDotClass = "bg-emerald-500";

  if (startTime && now < startTime) {
    assessmentStatus = "SCHEDULED";
    statusBadgeText = "Scheduled";
    statusBadgeClass =
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
    statusDotClass = "bg-amber-500";
  } else if (deadlineWithGrace && now > deadlineWithGrace) {
    assessmentStatus = "CLOSED";
    statusBadgeText = "Closed";
    statusBadgeClass =
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    statusDotClass = "bg-slate-400";
  }

  const totalQuestionsMarks = (set.questions || []).reduce(
    (sum, q) => sum + (q.max_marks || 0),
    0
  );

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
            {set.title}
          </span>
        </div>

        {/* 1. Assessment Overview Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Open / Closed Status Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${statusBadgeClass}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${statusDotClass} animate-pulse`}
                  />
                  <span>{statusBadgeText}</span>
                </span>

                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800 uppercase">
                  {set.grading_mode} Mode
                </span>

                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 uppercase">
                  Descriptive Exam
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {set.title}
              </h1>

              {set.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                  {set.description}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {user?.role === "student" && (
                <Link
                  to={`/sets/${id}/attempt`}
                  className={`px-5 py-2.5 font-semibold rounded-xl text-sm shadow-sm transition-all ${
                    assessmentStatus === "OPEN"
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  Take Exam
                </Link>
              )}

              {user?.role === "teacher" && (
                <>
                  <Link
                    to={`/sets/${id}/submissions`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <span>📥</span>
                    <span>View All Submissions</span>
                  </Link>

                  <Link
                    to={`/sets/${id}/comparison`}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs sm:text-sm transition-all flex items-center gap-1.5"
                  >
                    <span>📊</span>
                    <span>AI Comparison</span>
                  </Link>

                  <button
                    onClick={handleFinalizeAll}
                    className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 font-semibold rounded-xl hover:bg-amber-100 text-xs sm:text-sm transition-all"
                  >
                    Finalize All
                  </button>

                  {user?.id === set.teacher_id && (
                    <button
                      onClick={handleDelete}
                      className="px-3.5 py-2 bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900 font-semibold rounded-xl hover:bg-rose-100 text-xs sm:text-sm transition-all"
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Assessment Specifications (Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Subject */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Subject
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block truncate">
                {set.subject || "Not specified"}
              </span>
            </div>

            {/* Class / Cohort */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Class / Section
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                {set.branch} · Sem {set.semester} ({set.section})
              </span>
            </div>

            {/* Gated Window / Timing */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Deadline & Grace
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block truncate">
                {set.end_time ? formatDateTime(set.end_time) : "No deadline"}
              </span>
              {set.grace_period_minutes ? (
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  (+{set.grace_period_minutes}m grace window)
                </span>
              ) : null}
            </div>

            {/* Questions count */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Total Marks
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                {totalQuestionsMarks} Marks ({set.questions?.length || 0} Qs)
              </span>
            </div>

            {/* Author / Faculty */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Faculty Instructor
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block truncate">
                {set.teacher_name || "Faculty"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Option to View Question Set & Answer Key */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowQuestionSet((prev) => !prev)}
            className="w-full p-5 sm:p-6 flex items-center justify-between text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg">
                📝
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Question Set & Model Answer Key
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {showQuestionSet
                    ? "Click to collapse questions and answer keys"
                    : `View ${set.questions?.length || 0} questions and official evaluation answer keys`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {set.questions?.length || 0} Questions
              </span>
              <span className="text-slate-400 text-sm font-bold">
                {showQuestionSet ? "▲" : "▼"}
              </span>
            </div>
          </button>

          {/* Expanded Questions List */}
          {showQuestionSet && (
            <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/30 dark:bg-slate-950/20 animate-fade-in">
              {set.questions?.map((q, i) => (
                <div
                  key={q.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      Question {q.order && q.order > 0 ? q.order : i + 1}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {q.max_marks} Marks
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {q.question_text}
                  </p>

                  {user?.role === "teacher" && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Official Model Answer Key
                        </span>
                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-3 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {q.answer_key}
                        </div>
                      </div>

                      {q.rubric && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span>Grading Rubric / Marking Scheme</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold lowercase">
                              llm criteria
                            </span>
                          </span>
                          <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/60 rounded-xl p-3 text-xs font-mono text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
                            {q.rubric}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Below: Recent Submissions by Students */}
        {user?.role === "teacher" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Recent Submissions by Students
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click on any student submission to inspect their uploaded script and review AI grading.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {studentGroups.length} Submissions
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">#</th>
                    <th className="px-6 py-3.5">Student</th>
                    <th className="px-6 py-3.5">USN</th>
                    <th className="px-6 py-3.5">Submission Time</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-right">Awarded Score</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {studentGroups.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-slate-400 text-sm"
                      >
                        No student submissions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    studentGroups.map((group, index) => {
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
                                className={`w-8 h-8 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
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

                          <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
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
                              <span>Review</span>
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
        )}
      </div>

      {/* Student Submission Inspection Modal */}
      {selectedStudent && set && (
        <StudentSubmissionModal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          studentName={selectedStudent.studentName}
          studentUsn={selectedStudent.studentUsn}
          studentBranch={selectedStudent.studentBranch}
          submissions={selectedStudent.submissions}
          questions={set.questions || []}
          onSubmissionsUpdated={handleSubmissionsUpdated}
        />
      )}
    </div>
  );
}
