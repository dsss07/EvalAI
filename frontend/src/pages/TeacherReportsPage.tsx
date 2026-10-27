import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import type { EvaluationReport, ReportStatus } from "../types";

export default function TeacherReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<EvaluationReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReportStatus>("PENDING");
  const [searchQuery, setSearchQuery] = useState("");

  // Resolution modal state
  const [selectedReport, setSelectedReport] = useState<EvaluationReport | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<ReportStatus>("RESOLVED");
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  const loadReports = async () => {
    try {
      const { data } = await api.get<EvaluationReport[]>("/api/reports/teacher");
      setReports(data);
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const getStudentName = (r: EvaluationReport) => r.studentName || r.student_name || "Student";
  const getStudentUsn = (r: EvaluationReport) => r.studentUsn || r.student_usn || "";
  const getStudentEmail = (r: EvaluationReport) => r.studentEmail || r.student_email || "";
  const getSetTitle = (r: EvaluationReport) => r.setTitle || r.set_title || "Assessment";
  const getSetId = (r: EvaluationReport) => r.setId || r.set_id || "";
  const getQuestionNumber = (r: EvaluationReport) => r.questionNumber ?? r.question_number ?? null;
  const getResolutionRemarks = (r: EvaluationReport) => r.resolutionRemarks || r.resolution_remarks || "";
  const getCreatedAt = (r: EvaluationReport) => r.createdAt || r.created_at || "";

  const counts = useMemo(() => {
    let pending = 0;
    let resolved = 0;
    let rejected = 0;
    for (const r of reports) {
      if (r.status === "PENDING") pending++;
      else if (r.status === "RESOLVED") resolved++;
      else if (r.status === "REJECTED") rejected++;
    }
    return { pending, resolved, rejected, total: reports.length };
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = getStudentName(r).toLowerCase().includes(q);
        const matchesUsn = getStudentUsn(r).toLowerCase().includes(q);
        const matchesEmail = getStudentEmail(r).toLowerCase().includes(q);
        const matchesTitle = getSetTitle(r).toLowerCase().includes(q);
        const matchesSubject = (r.subject || "").toLowerCase().includes(q);
        if (!matchesName && !matchesUsn && !matchesEmail && !matchesTitle && !matchesSubject) {
          return false;
        }
      }
      return true;
    });
  }, [reports, statusFilter, searchQuery]);

  const openResolveModal = (report: EvaluationReport) => {
    setSelectedReport(report);
    setResolutionStatus("RESOLVED");
    setResolutionRemarks(getResolutionRemarks(report));
    setResolveError("");
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    setResolving(true);
    setResolveError("");
    try {
      const { data } = await api.patch<EvaluationReport>(`/api/reports/${selectedReport.id}/resolve`, {
        status: resolutionStatus,
        resolutionRemarks: resolutionRemarks.trim(),
        resolution_remarks: resolutionRemarks.trim(),
      });
      setReports((prev) => prev.map((r) => (r.id === data.id ? data : r)));
      setSelectedReport(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update report status.";
      setResolveError(msg);
    } finally {
      setResolving(false);
    }
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 dark:bg-slate-950 flex flex-col lg:flex-row">
      {/* 1. Left Sidebar Navigation */}
      <aside className="sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 z-30 hidden lg:flex flex-col p-4 shrink-0">
        <div className="space-y-1.5 flex-1">
          {/* Dashboard item */}
          <Link
            to="/"
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
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Dashboard</span>
          </Link>

          {/* Students item */}
          <Link
            to="/teacher/students"
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
          <Link
            to="/#assessments"
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
            </svg>
            <span>Assessments</span>
          </Link>

          {/* Reports item (Active) */}
          <Link
            to="/teacher/reports"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
          >
            <div className="flex items-center gap-3">
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
            </div>
            {counts.pending > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                {counts.pending}
              </span>
            )}
          </Link>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                Evaluation Discrepancy Desk
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              Student Discrepancy Reports
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 max-w-2xl">
              Inspect student-submitted marking discrepancy appeals, review original script answers,
              and apply manual mark overrides or resolve reports.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadReports}
              className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>↻</span> Refresh
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => setStatusFilter("PENDING")}
            className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
              statusFilter === "PENDING"
                ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20"
                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-300"
            }`}
          >
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Pending Reviews
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {counts.pending}
              </span>
              <span className="text-xs text-amber-600/80 dark:text-amber-400/80">needs action</span>
            </div>
          </div>

          <div
            onClick={() => setStatusFilter("RESOLVED")}
            className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
              statusFilter === "RESOLVED"
                ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300"
            }`}
          >
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Resolved Reports
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {counts.resolved}
              </span>
              <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">completed</span>
            </div>
          </div>

          <div
            onClick={() => setStatusFilter("ALL")}
            className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-sm ${
              statusFilter === "ALL"
                ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20"
                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-300"
            }`}
          >
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Total Inquiries
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {counts.total}
              </span>
              <span className="text-xs text-slate-400">all appeals</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter("PENDING")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === "PENDING"
                  ? "bg-amber-600 text-white shadow-sm shadow-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Pending ({counts.pending})
            </button>
            <button
              onClick={() => setStatusFilter("RESOLVED")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === "RESOLVED"
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Resolved ({counts.resolved})
            </button>
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === "ALL"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              All Reports ({counts.total})
            </button>
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-72 relative">
            <input
              type="text"
              placeholder="Search student, USN, or exam..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Table of Reports */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 flex justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-16 text-center">
              <span className="text-3xl block mb-2">🎉</span>
              <p className="text-slate-700 dark:text-slate-200 font-semibold text-sm">
                No reports found matching criteria.
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {statusFilter === "PENDING"
                  ? "All student discrepancy inquiries have been reviewed and resolved!"
                  : "Try clearing search filters or changing the status filter tab."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Assessment / Subject</th>
                    <th className="py-3.5 px-4">Reported Scope</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Discrepancy Details</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredReports.map((report) => {
                    const isPending = report.status === "PENDING";
                    const isResolved = report.status === "RESOLVED";

                    return (
                      <tr
                        key={report.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {getStudentName(report)}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {getStudentUsn(report) || getStudentEmail(report)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200 max-w-[160px] truncate">
                            {getSetTitle(report)}
                          </div>
                          {report.subject && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              📚 {report.subject}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {getQuestionNumber(report) ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-900/60 text-[11px]">
                              Question #{getQuestionNumber(report)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                              Overall Exam
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {report.reason}
                          </p>
                          {getResolutionRemarks(report) && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                              <span>✓</span> {getResolutionRemarks(report)}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                          {formatTimestamp(getCreatedAt(report))}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <span>⏳</span> Pending
                            </span>
                          )}
                          {isResolved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span>✓</span> Resolved
                            </span>
                          )}
                          {!isPending && !isResolved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              {report.status}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/teacher/submissions/${getSetId(report)}`)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors"
                            title="Open student submission to override marks"
                          >
                            Review & Override ➔
                          </button>

                          <button
                            type="button"
                            onClick={() => openResolveModal(report)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                            title="Update resolution status"
                          >
                            Resolve...
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Resolve Dialog Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
                  ✓
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Update Report Status
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {getStudentName(selectedReport)} • {getSetTitle(selectedReport)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4 text-xs">
              {resolveError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                  {resolveError}
                </div>
              )}

              {/* Student Reported Reason preview */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                  Student Reason ({getQuestionNumber(selectedReport) ? `Q#${getQuestionNumber(selectedReport)}` : "Overall"})
                </span>
                <p className="text-slate-800 dark:text-slate-200 italic leading-relaxed">
                  "{selectedReport.reason}"
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                  Resolution Outcome
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolutionStatus("RESOLVED")}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                      resolutionStatus === "RESOLVED"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    ✓ Resolved / Corrected
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolutionStatus("REJECTED")}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                      resolutionStatus === "REJECTED"
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    ✕ Dismiss / Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">
                  Faculty Resolution Remarks
                </label>
                <textarea
                  rows={3}
                  value={resolutionRemarks}
                  onChange={(e) => setResolutionRemarks(e.target.value)}
                  placeholder="e.g., 'Marks corrected on question 2 after reviewing handwriting.' or 'Verified original OCR text, marks awarded as per rubric.'"
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="px-5 py-2 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all shadow-sm flex items-center gap-1.5"
                >
                  {resolving ? "Saving..." : "Save Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
