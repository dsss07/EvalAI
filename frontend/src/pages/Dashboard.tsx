import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { apiCall } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { QuestionSet } from "../types";
import { getDeadlineStatus } from "../utils/dateUtils";
import StudentExamModal from "../components/StudentExamModal";

// Four rotating accent color palettes for assessment cards matching screenshot
const CARD_PALETTES = [
  {
    iconBox: "bg-blue-50 text-blue-500 border-blue-100",
    subjectText: "text-slate-900 group-hover:text-blue-600",
  },
  {
    iconBox: "bg-rose-50 text-rose-500 border-rose-100",
    subjectText: "text-slate-900 group-hover:text-rose-600",
  },
  {
    iconBox: "bg-purple-50 text-purple-500 border-purple-100",
    subjectText: "text-slate-900 group-hover:text-purple-600",
  },
  {
    iconBox: "bg-amber-50 text-amber-500 border-amber-100",
    subjectText: "text-slate-900 group-hover:text-amber-600",
  },
];

function formatExamDeadline(dateString?: string | null): string {
  if (!dateString) return "No deadline set";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "No deadline set";
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    const time = d
      .toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
    return `${day} ${month} ${year}, ${time}`;
  } catch {
    return "No deadline set";
  }
}

function getAssessmentStatusInfo(
  status?: string,
  endTime?: string | null,
  gracePeriodMinutes: number = 5
) {
  if (status === "COMPLETED") {
    return {
      label: "Completed",
      subtext: "Evaluation Done",
      badgeClass: "bg-blue-50 text-blue-700 border border-blue-200",
      dotClass: "bg-blue-600",
    };
  }
  if (status === "DRAFT" || status === "ARCHIVED") {
    return {
      label: "Draft",
      subtext: "Not Published",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
      dotClass: "bg-amber-500",
    };
  }

  // Active or check deadline
  if (endTime) {
    const endMs =
      new Date(endTime).getTime() + (gracePeriodMinutes || 0) * 60 * 1000;
    if (Date.now() > endMs) {
      return {
        label: "Closed",
        subtext: "Deadline Passed",
        badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
        dotClass: "bg-slate-400",
      };
    }
  }

  return {
    label: "Active",
    subtext: "Window Open",
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dotClass: "bg-emerald-500",
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittedSetIds, setSubmittedSetIds] = useState<string[]>([]);

  // Student specific modal & filters
  const [selectedExamModalSet, setSelectedExamModalSet] = useState<QuestionSet | null>(null);
  const [studentFilter, setStudentFilter] = useState<"ALL" | "YET_TO_SUBMIT" | "SUBMITTED" | "SKIPPED">("ALL");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Teacher filters & search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSemester, setSelectedSemester] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [selectedSubject, setSelectedSubject] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Listen to mobile hamburger toggle from Navbar
  useEffect(() => {
    const handleToggle = () => setMobileSidebarOpen((prev) => !prev);
    window.addEventListener("toggle-sidebar", handleToggle);
    return () => window.removeEventListener("toggle-sidebar", handleToggle);
  }, []);

  const fetchSets = async () => {
    try {
      const [setsResponse, statusResponse, submissionsResponse] = await Promise.all([
        apiCall("/api/question-sets", { method: "GET" }),
        user?.role === "student"
          ? apiCall("/api/submissions/status", { method: "GET" }).catch(() => ({
              data: { submitted_set_ids: [] },
            }))
          : Promise.resolve({ data: { submitted_set_ids: [] } }),
        user?.role === "student"
          ? apiCall("/api/submissions", { method: "GET" }).catch(() => ({
              data: [],
            }))
          : Promise.resolve({ data: [] }),
      ]);
      setSets(setsResponse.data);

      const setIds = new Set<string>();
      if (statusResponse?.data?.submitted_set_ids && Array.isArray(statusResponse.data.submitted_set_ids)) {
        statusResponse.data.submitted_set_ids.forEach((id: string) => setIds.add(id));
      }
      if (Array.isArray(submissionsResponse?.data)) {
        for (const submission of submissionsResponse.data as any[]) {
          const setId =
            submission.set_id ||
            submission.question_set_id ||
            submission.question?.question_set_id ||
            setsResponse.data.find((set: any) =>
              set.questions?.some((q: any) => q.id === submission.question_id)
            )?.id;
          if (setId) setIds.add(setId);
        }
      }
      setSubmittedSetIds([...setIds]);
    } catch (err) {
      console.error("Failed to load question sets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, [user?.role]);

  // Derived filter options
  const semesters = useMemo(() => {
    const list = Array.from(
      new Set(sets.map((s) => s.semester).filter(Boolean))
    ).sort((a, b) => a - b);
    return list;
  }, [sets]);

  const sections = useMemo(() => {
    const list = Array.from(
      new Set(sets.map((s) => s.section).filter(Boolean))
    ).sort();
    return list;
  }, [sets]);

  const subjects = useMemo(() => {
    const list = Array.from(
      new Set(sets.map((s) => s.subject || "General").filter(Boolean))
    ).sort();
    return list;
  }, [sets]);

  // Filtered assessment sets
  const filteredSets = useMemo(() => {
    return sets.filter((s) => {
      // Search matching title, subject, branch, description
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = s.title?.toLowerCase().includes(q);
        const matchesSubject = s.subject?.toLowerCase().includes(q);
        const matchesBranch = s.branch?.toLowerCase().includes(q);
        const matchesDesc = s.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSubject && !matchesBranch && !matchesDesc) {
          return false;
        }
      }

      // Semester filter
      if (selectedSemester !== "All" && s.semester !== Number(selectedSemester)) {
        return false;
      }

      // Section filter
      if (selectedSection !== "All" && s.section !== selectedSection) {
        return false;
      }

      // Subject filter
      if (selectedSubject !== "All") {
        const subj = s.subject || "General";
        if (subj !== selectedSubject) return false;
      }

      return true;
    });
  }, [sets, searchQuery, selectedSemester, selectedSection, selectedSubject]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSemester("All");
    setSelectedSection("All");
    setSelectedSubject("All");
  };

  const handleDeleteSet = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "Are you sure you want to delete this question set? This action cannot be undone."
      )
    ) {
      return;
    }
    try {
      await api.delete(`/api/question-sets/${id}`);
      setSets((prev) => prev.filter((s) => s.id !== id));
      setOpenActionMenuId(null);
    } catch {
      alert("Failed to delete assessment.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // -------------------------------------------------------------
  // STUDENT VIEW (Clean, modern White & Royal Blue theme)
  // -------------------------------------------------------------
  if (user?.role === "student") {
    const studentSets = sets;

    const getStudentSetStatus = (qs: QuestionSet): "SUBMITTED" | "SKIPPED" | "YET_TO_SUBMIT" => {
      if (submittedSetIds.includes(qs.id)) return "SUBMITTED";
      const deadlineInfo = getDeadlineStatus(
        qs.start_time,
        qs.end_time,
        qs.grace_period_minutes
      );
      if (deadlineInfo.isExpired) return "SKIPPED";
      return "YET_TO_SUBMIT";
    };

    const submittedCount = studentSets.filter((qs) => getStudentSetStatus(qs) === "SUBMITTED").length;
    const skippedCount = studentSets.filter((qs) => getStudentSetStatus(qs) === "SKIPPED").length;
    const yetToSubmitCount = studentSets.filter((qs) => getStudentSetStatus(qs) === "YET_TO_SUBMIT").length;

    const filteredStudentSets = studentSets.filter((qs) => {
      const status = getStudentSetStatus(qs);
      if (studentFilter !== "ALL" && status !== studentFilter) {
        return false;
      }
      if (studentSearchQuery.trim()) {
        const q = studentSearchQuery.toLowerCase();
        const matchesTitle = qs.title?.toLowerCase().includes(q);
        const matchesSubject = qs.subject?.toLowerCase().includes(q);
        const matchesBranch = qs.branch?.toLowerCase().includes(q);
        const matchesDesc = qs.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSubject && !matchesBranch && !matchesDesc) {
          return false;
        }
      }
      return true;
    });

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Hero Greeting Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-2 uppercase tracking-wider">
                Student Portal
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                Welcome back, {user?.full_name || "Student"} 👋
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Enrolled in {user?.branch || "Department"} · Semester {user?.semester || "5"} · Section {user?.section || "A"} {user?.usn ? `(${user.usn})` : ""}
              </p>
            </div>

            {/* Quick shortcuts */}
            <div className="flex items-center gap-3">
              <Link
                to="/my-results"
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>🎓</span>
                <span>My Results</span>
              </Link>

              <Link
                to="/profile"
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>👤</span>
                <span>My Profile</span>
              </Link>
            </div>
          </div>

          {/* 4-Card Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div
              onClick={() => setStudentFilter("ALL")}
              className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                studentFilter === "ALL"
                  ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
              }`}
            >
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Total Enrolled
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {studentSets.length}
                </span>
                <span className="text-xs text-slate-400">exams</span>
              </div>
            </div>

            <div
              onClick={() => setStudentFilter("YET_TO_SUBMIT")}
              className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                studentFilter === "YET_TO_SUBMIT"
                  ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-300"
              }`}
            >
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Yet to Submit
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {yetToSubmitCount}
                </span>
                <span className="text-xs text-amber-600/80 dark:text-amber-400/80">pending</span>
              </div>
            </div>

            <div
              onClick={() => setStudentFilter("SUBMITTED")}
              className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                studentFilter === "SUBMITTED"
                  ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300"
              }`}
            >
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Submitted
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {submittedCount}
                </span>
                <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">completed</span>
              </div>
            </div>

            <div
              onClick={() => setStudentFilter("SKIPPED")}
              className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                studentFilter === "SKIPPED"
                  ? "bg-rose-50/70 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-rose-300"
              }`}
            >
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Skipped
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {skippedCount}
                </span>
                <span className="text-xs text-rose-600/80 dark:text-rose-400/80">missed</span>
              </div>
            </div>
          </div>

          {/* Assessment Filtering & Search Controls */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Assessment Schedule
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click any assessment card to inspect exam questions, timings, guidelines, and submission status.
                </p>
              </div>

              {/* Search & Status Tab Filter Pills */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative">
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="Search assessments..."
                    className="w-full sm:w-48 pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
                  {studentSearchQuery && (
                    <button
                      onClick={() => setStudentSearchQuery("")}
                      className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setStudentFilter("ALL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      studentFilter === "ALL"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    All ({studentSets.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentFilter("YET_TO_SUBMIT")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      studentFilter === "YET_TO_SUBMIT"
                        ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-amber-600"
                    }`}
                  >
                    ⏳ Yet to submit ({yetToSubmitCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentFilter("SUBMITTED")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      studentFilter === "SUBMITTED"
                        ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-emerald-600"
                    }`}
                  >
                    ✓ Submitted ({submittedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentFilter("SKIPPED")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      studentFilter === "SKIPPED"
                        ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-rose-600"
                    }`}
                  >
                    ✕ Skipped ({skippedCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Assessment Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredStudentSets.length === 0 ? (
                <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-16 text-center text-slate-400 shadow-sm">
                  <span className="text-4xl mb-3 block">📚</span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No assessments match the selected filter.
                  </p>
                  <button
                    onClick={() => setStudentFilter("ALL")}
                    className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    View All Assessments ({studentSets.length})
                  </button>
                </div>
              ) : (
                filteredStudentSets.map((qs) => {
                  const status = getStudentSetStatus(qs);
                  const isSubmitted = status === "SUBMITTED";
                  const isSkipped = status === "SKIPPED";

                  const deadlineInfo = getDeadlineStatus(
                    qs.start_time,
                    qs.end_time,
                    qs.grace_period_minutes
                  );

                  let borderClass = "border-l-blue-600";
                  if (isSubmitted) {
                    borderClass = "border-l-emerald-500";
                  } else if (isSkipped) {
                    borderClass = "border-l-rose-500";
                  } else if (deadlineInfo.isUpcoming) {
                    borderClass = "border-l-slate-400";
                  } else {
                    borderClass = "border-l-amber-500";
                  }

                  return (
                    <div
                      key={qs.id}
                      onClick={() => setSelectedExamModalSet(qs)}
                      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 border-l-4 ${borderClass} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 cursor-pointer group`}
                    >
                      <div>
                        {/* Status & Type Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          {/* Submission Status Pill */}
                          {isSubmitted ? (
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shadow-sm">
                              <span>✓</span> Submitted
                            </span>
                          ) : isSkipped ? (
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1 shadow-sm">
                              <span>✕</span> Skipped
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 shadow-sm">
                              <span>⏳</span> Yet to submit
                            </span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                qs.test_type === "MCQ"
                                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                              }`}
                            >
                              {qs.test_type || "DESCRIPTIVE"}
                            </span>

                            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                              Sem {qs.semester}
                            </span>
                          </div>
                        </div>

                        {/* Title & Subject */}
                        <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {qs.title}
                        </h3>

                        {qs.subject && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                            📚 {qs.subject}
                          </p>
                        )}

                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                          {qs.description || "No specific instructions provided. Click to view exam details and question paper."}
                        </p>
                      </div>

                      {/* Card Bottom Section */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                        {/* Deadline Row */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Deadline:</span>
                          <span
                            className={`font-semibold ${
                              deadlineInfo.isExpired
                                ? "text-rose-600 dark:text-rose-400"
                                : deadlineInfo.isGrace
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {deadlineInfo.formattedDeadline || "Self-paced"}
                          </span>
                        </div>

                        {/* Details & Action Buttons */}
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedExamModalSet(qs)}
                            className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <span>📄 View Exam & Questions</span>
                            <span>➔</span>
                          </button>

                          {isSubmitted ? (
                            <Link
                              to="/my-results"
                              className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors shadow-sm"
                            >
                              <span>✓ Submitted · View My Results ➔</span>
                            </Link>
                          ) : isSkipped ? (
                            <button
                              disabled
                              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 text-xs font-semibold cursor-not-allowed text-center"
                            >
                              ✕ Window Closed · Skipped
                            </button>
                          ) : deadlineInfo.isUpcoming ? (
                            <button
                              disabled
                              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-not-allowed text-center"
                            >
                              🕒 Opens at {deadlineInfo.formattedStart}
                            </button>
                          ) : (
                            <Link
                              to={
                                qs.test_type === "MCQ"
                                  ? `/student/test/${qs.id}`
                                  : `/test/${qs.id}`
                              }
                              className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all active:scale-[0.99]"
                            >
                              <span>Start Assessment</span>
                              <span>➔</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Student Exam Details & Questions Modal */}
        {selectedExamModalSet && (
          <StudentExamModal
            set={selectedExamModalSet}
            isSubmitted={submittedSetIds.includes(selectedExamModalSet.id)}
            onClose={() => setSelectedExamModalSet(null)}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // TEACHER HOME PAGE (Matches uploaded design mockup)
  // -------------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 dark:bg-slate-950 flex flex-col lg:flex-row">
      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* 1. Left Sidebar Navigation */}
      <aside
        className={`fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 z-30 flex flex-col p-4 transition-transform duration-200 ease-in-out shrink-0 ${
          mobileSidebarOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="space-y-1.5 flex-1">
          {/* Dashboard item (Active) */}
          <Link
            to="/"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Dashboard</span>
          </Link>

          {/* Students item */}
          <Link
            to="/teacher/students"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Students</span>
          </Link>

          {/* Analytics item */}
          <Link
            to="/analytics"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Analytics</span>
          </Link>

          {/* Assessments item */}
          <a
            href="#assessments"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Assessments</span>
          </a>

          {/* Reports item */}
          <Link
            to="/teacher/reports"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            <span>Reports</span>
          </Link>

          {/* Create Exam item */}
          <button
            type="button"
            onClick={() => {
              setCreateModalOpen(true);
              setMobileSidebarOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M8 12h8" />
              <path d="M12 8v8" />
            </svg>
            <span>Create Exam</span>
          </button>
        </div>

        {/* Sidebar Footer Info */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 px-3">
          <span>EvalAI Faculty Edition v2.5</span>
        </div>
      </aside>

      {/* 2. Main Content Container */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 page-enter">
        {/* Hero Greeting Card matching screenshot */}
        <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-100/70 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-900 border border-blue-100/80 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 overflow-hidden">
          {/* Subtle soft lighting blob */}
          <div className="absolute -right-8 -bottom-8 w-60 h-60 bg-blue-300/30 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Left Greeting Text */}
          <div className="relative z-10">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              TEACHER DASHBOARD
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 flex items-center gap-2">
              <span>
                Welcome back,{" "}
                {user?.full_name?.toLowerCase().startsWith("prof")
                  ? user?.full_name
                  : `Prof. ${user?.full_name || "Teacher"}`}
              </span>
              <span>👋</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 max-w-xl">
              Manage your assessments, students and view analytics all in one place.
            </p>
          </div>

          {/* Right Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 relative z-10 shrink-0">
            {/* Create MCQ Exam (PDF) */}
            <Link
              to="/sets/new-mcq"
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-semibold px-5 py-3 rounded-2xl shadow-md shadow-purple-500/25 flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Create MCQ Exam (PDF)</span>
            </Link>

            {/* Create Descriptive Exam */}
            <Link
              to="/sets/new"
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-5 py-3 rounded-2xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Create Descriptive Exam</span>
            </Link>
          </div>
        </div>

        {/* 3. Your Assessments Section */}
        <section id="assessments" className="space-y-4">
          {/* Top Section Header with Search & Filter Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Your Assessments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                View and manage all your question sets and exams.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Search input with icon */}
              <div className="relative w-full sm:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, subject, or class..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all"
                />
              </div>

              {/* Filter button */}
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
              >
                <svg
                  className="w-3.5 h-3.5 text-slate-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <span>Filter</span>
                <span className="text-[10px] text-slate-400">
                  {showFilters ? "▲" : "▼"}
                </span>
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Row */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {/* Semester Dropdown */}
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="All">Semester (All)</option>
                {semesters.map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>

              {/* Section Dropdown */}
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="All">Section (All)</option>
                {sections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>

              {/* Subject Dropdown */}
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="All">Subject (All)</option>
                {subjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>

              {/* Reset Filters button */}
              {(selectedSemester !== "All" ||
                selectedSection !== "All" ||
                selectedSubject !== "All" ||
                searchQuery.trim() !== "") && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <span>🔄</span>
                  <span>Reset</span>
                </button>
              )}
            </div>
          )}

          {/* Assessment Cards List */}
          <div className="space-y-3 pt-2">
            {filteredSets.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
                <span className="text-3xl block mb-2">📋</span>
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  No assessments found
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Try adjusting your search criteria or create a new exam set.
                </p>
              </div>
            ) : (
              filteredSets.map((qs, index) => {
                const palette = CARD_PALETTES[index % CARD_PALETTES.length];
                const deadlineFormatted = formatExamDeadline(qs.end_time);
                const statusInfo = getAssessmentStatusInfo(
                  qs.status,
                  qs.end_time,
                  qs.grace_period_minutes
                );
                const targetUrl =
                  qs.test_type === "MCQ"
                    ? `/sets/mcq/${qs.id}`
                    : `/sets/${qs.id}`;

                return (
                  <div
                    key={qs.id}
                    onClick={() => navigate(targetUrl)}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400/80 dark:hover:border-blue-500/40 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
                  >
                    {/* Left: Document Icon + Subject / Title + Metadata Tags */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Document Icon Box */}
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${palette.iconBox}`}
                      >
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>

                      {/* Content block */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <h3
                            className={`font-bold text-base sm:text-lg tracking-tight leading-snug transition-colors ${palette.subjectText}`}
                          >
                            {qs.subject || "General"}
                          </h3>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5">
                          {qs.title}
                        </p>

                        {/* Badges Row */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          {/* Semester */}
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            Sem {qs.semester}
                          </span>

                          {/* Section */}
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Sec {qs.section}
                          </span>

                          {/* Branch */}
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                            {qs.branch}
                          </span>

                          {/* Exam Type / Grading Mode Badge */}
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3 text-slate-400"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect width="18" height="18" x="3" y="3" rx="2" />
                              <path d="M3 9h18" />
                            </svg>
                            <span>
                              {qs.test_type === "MCQ"
                                ? "MCQ Test"
                                : qs.grading_mode
                                ? `${qs.grading_mode.toUpperCase()} Exam`
                                : "Mid Exam"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Center: Deadline Information */}
                    <div className="flex items-center gap-3 md:px-4 md:border-l md:border-slate-100 dark:md:border-slate-800 shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center shrink-0">
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Deadline
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {deadlineFormatted}
                        </span>
                      </div>
                    </div>

                    {/* Right: Status Pill & Action Buttons */}
                    <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      {/* Status badge with colored dot + subtext */}
                      <div className="text-center min-w-[90px]">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${statusInfo.badgeClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`}
                          />
                          <span>{statusInfo.label}</span>
                        </span>
                        <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                          {statusInfo.subtext}
                        </span>
                      </div>

                      {/* Three-dots menu & Chevron */}
                      <div className="flex items-center gap-1.5 relative">
                        {/* Action menu trigger */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(
                              openActionMenuId === qs.id ? null : qs.id
                            );
                          }}
                          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          aria-label="Assessment options"
                          title="Options"
                        >
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="19" r="1" />
                          </svg>
                        </button>

                        {/* Action Dropdown Popup */}
                        {openActionMenuId === qs.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-6 top-8 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 text-xs divide-y divide-slate-100 dark:divide-slate-800 animate-fade-in"
                          >
                            <div className="py-1">
                              <Link
                                to={targetUrl}
                                className="block px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                              >
                                View Exam Details
                              </Link>
                              {qs.test_type !== "MCQ" && (
                                <Link
                                  to={`/sets/${qs.id}/submissions`}
                                  className="block px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                                >
                                  View Submissions
                                </Link>
                              )}
                              <Link
                                to={`/sets/${qs.id}/comparison`}
                                className="block px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                              >
                                Comparative Analysis
                              </Link>
                            </div>
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSet(qs.id, e)}
                                className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-medium"
                              >
                                Delete Assessment
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Chevron Right Arrow */}
                        <div className="p-1 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all">
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* Quick Create Exam Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Create New Exam
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose the assessment format you want to create
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Link
                to="/sets/new-mcq"
                onClick={() => setCreateModalOpen(false)}
                className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900/50 hover:border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50 transition-all flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-600">
                    Create MCQ Exam (PDF)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Extract questions & answer keys automatically from exam PDF
                  </p>
                </div>
              </Link>

              <Link
                to="/sets/new"
                onClick={() => setCreateModalOpen(false)}
                className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 hover:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 transition-all flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600">
                    Create Descriptive Exam
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Author subjective questions or upload marking scheme
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
