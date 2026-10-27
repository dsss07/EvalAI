import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

interface Student {
  id: string;
  email: string;
  full_name?: string;
  fullName?: string;
  usn?: string;
  semester?: number;
  section?: string;
  branch?: string;
  role?: string;
  created_at?: string;
  createdAt?: string;
  phone?: string;
}

const AVATAR_PALETTES = [
  "bg-purple-100 text-purple-600",
  "bg-blue-100 text-blue-600",
  "bg-sky-100 text-sky-600",
  "bg-pink-100 text-pink-600",
  "bg-purple-100 text-purple-700",
  "bg-indigo-100 text-indigo-600",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-600",
  "bg-teal-100 text-teal-600",
  "bg-amber-100 text-amber-600",
];

function getStudentName(s: Student): string {
  return s.full_name || s.fullName || "Student";
}

function getRegistrationDate(isoString?: string): string {
  if (!isoString) return "10 Aug 2023, 11:24 AM";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "10 Aug 2023, 11:24 AM";
    const day = d.getDate();
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();
    const time = d.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${day} ${month} ${year}, ${time}`;
  } catch {
    return "10 Aug 2023, 11:24 AM";
  }
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSemester, setSelectedSemester] = useState<string>("All");
  const [selectedCourse, setSelectedCourse] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Modals & Menu
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createExamModalOpen, setCreateExamModalOpen] = useState(false);
  const [actionMenuStudentId, setActionMenuStudentId] = useState<string | null>(null);

  // Form state for creating student
  const [addForm, setAddForm] = useState({
    fullName: "",
    email: "",
    usn: "",
    semester: 5,
    branch: "CSE",
    section: "A",
    temporaryPassword: "",
  });
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ name: string; password: string } | null>(null);

  // Form state for editing student
  const [editForm, setEditForm] = useState({
    fullName: "",
    usn: "",
    semester: 5,
    branch: "CSE",
    section: "A",
    temporaryPassword: "",
  });
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Load students from backend
  const loadStudents = async () => {
    try {
      const { data } = await api.get("/api/teacher/students");
      setStudents(data);
    } catch (err) {
      console.error("Could not load students", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const name = getStudentName(s).toLowerCase();
      const usn = (s.usn || "").toLowerCase();
      const email = (s.email || "").toLowerCase();

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!name.includes(q) && !usn.includes(q) && !email.includes(q)) {
          return false;
        }
      }

      if (selectedSemester !== "All" && s.semester !== Number(selectedSemester)) {
        return false;
      }

      if (selectedCourse !== "All") {
        const branch = (s.branch || "CSE").toUpperCase();
        if (branch !== selectedCourse.toUpperCase()) return false;
      }

      if (selectedSection !== "All") {
        const sec = (s.section || "A").toUpperCase();
        if (sec !== selectedSection.toUpperCase()) return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedSemester, selectedCourse, selectedSection]);

  // Paginated students
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSemester("All");
    setSelectedCourse("All");
    setSelectedSection("All");
    setCurrentPage(1);
  };

  // Create Student submit
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setCreatedInfo(null);
    setAddLoading(true);
    try {
      const payload = {
        fullName: addForm.fullName.trim(),
        full_name: addForm.fullName.trim(),
        email: addForm.email.trim(),
        usn: addForm.usn.trim(),
        semester: Number(addForm.semester),
        branch: addForm.branch.trim(),
        section: addForm.section.trim(),
        temporaryPassword: addForm.temporaryPassword ? addForm.temporaryPassword.trim() : "",
        temporary_password: addForm.temporaryPassword ? addForm.temporaryPassword.trim() : "",
      };

      const { data } = await api.post("/api/teacher/students", payload);

      const newStudent: Student = data.student;
      setStudents((prev) => [newStudent, ...prev]);
      setCreatedInfo({
        name: getStudentName(newStudent),
        password: data.temporary_password || data.temporaryPassword,
      });
      setAddForm({
        fullName: "",
        email: "",
        usn: "",
        semester: 5,
        branch: "CSE",
        section: "A",
        temporaryPassword: "",
      });
    } catch (err: any) {
      const respData = err?.response?.data;
      let errorMsg = respData?.message || respData?.detail;
      if (!errorMsg && respData?.field_errors) {
        errorMsg = Object.entries(respData.field_errors)
          .map(([f, msg]) => `${f}: ${msg}`)
          .join(", ");
      }
      setAddError(errorMsg || "Failed to create student account.");
    } finally {
      setAddLoading(false);
    }
  };

  // Open edit modal
  const openEditModalForStudent = (s: Student) => {
    setEditForm({
      fullName: getStudentName(s),
      usn: s.usn || "",
      semester: s.semester || 5,
      branch: s.branch || "CSE",
      section: s.section || "A",
      temporaryPassword: "",
    });
    setEditError("");
    setEditModalOpen(true);
    setActionMenuStudentId(null);
  };

  // Submit edit student
  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setEditError("");
    setEditLoading(true);
    try {
      const payload = {
        fullName: editForm.fullName.trim(),
        full_name: editForm.fullName.trim(),
        usn: editForm.usn.trim(),
        semester: Number(editForm.semester),
        branch: editForm.branch.trim(),
        section: editForm.section.trim(),
        temporaryPassword: editForm.temporaryPassword ? editForm.temporaryPassword.trim() : "",
        temporary_password: editForm.temporaryPassword ? editForm.temporaryPassword.trim() : "",
      };

      const { data } = await api.put(`/api/teacher/students/${selectedStudent.id}`, payload);
      setStudents((prev) =>
        prev.map((s) => (s.id === selectedStudent.id ? { ...s, ...data } : s))
      );
      setSelectedStudent((prev) => (prev ? { ...prev, ...data } : null));
      setEditModalOpen(false);
    } catch (err: any) {
      const respData = err?.response?.data;
      let errorMsg = respData?.message || respData?.detail;
      if (!errorMsg && respData?.field_errors) {
        errorMsg = Object.entries(respData.field_errors)
          .map(([f, msg]) => `${f}: ${msg}`)
          .join(", ");
      }
      setEditError(errorMsg || "Failed to update student details.");
    } finally {
      setEditLoading(false);
    }
  };

  // Delete student
  const handleDeleteStudent = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this student account?")) {
      return;
    }
    try {
      await api.delete(`/api/teacher/students/${id}`);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      if (selectedStudent?.id === id) {
        setSelectedStudent(null);
      }
      setActionMenuStudentId(null);
    } catch {
      alert("Failed to delete student account.");
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

          {/* Students item (Active) */}
          <Link
            to="/teacher/students"
            onClick={() => setSelectedStudent(null)}
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

          {/* Reports item */}
          <Link
            to="/teacher/reports"
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
            onClick={() => setCreateExamModalOpen(true)}
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

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 px-3">
          <span>EvalAI Faculty Edition v2.5</span>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full page-enter">
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : selectedStudent ? (
          /* =========================================================================
             IMAGE 2: STUDENT DETAIL VIEW (After clicking on a student)
             ========================================================================= */
          <div className="space-y-6 animate-fade-in">
            {/* Breadcrumbs Navigation */}
            <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="hover:text-blue-600 font-medium transition-colors"
              >
                Students
              </button>
              <span className="text-slate-400">›</span>
              <span className="text-slate-900 dark:text-white font-semibold">
                {getStudentName(selectedStudent)}
              </span>
            </nav>

            {/* Top Student Profile Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-5">
                {/* Large Avatar Circle */}
                <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 font-bold text-3xl flex items-center justify-center shrink-0 shadow-sm">
                  {getStudentName(selectedStudent).charAt(0).toUpperCase()}
                </div>

                {/* Profile Details */}
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {getStudentName(selectedStudent)}
                  </h1>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedStudent.usn || "No USN registered"}
                  </p>

                  <div className="mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                      Active
                    </span>
                  </div>

                  {/* Email & Phone Contact Info */}
                  <div className="flex flex-wrap items-center gap-5 mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="w-4 h-4 text-slate-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      <span>{selectedStudent.email}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <svg
                        className="w-4 h-4 text-slate-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span>{selectedStudent.phone || "+91 98765 43210"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit Student Button */}
              <button
                type="button"
                onClick={() => openEditModalForStudent(selectedStudent)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm flex items-center justify-center gap-2 transition-colors shrink-0"
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
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                <span>Edit Student</span>
              </button>
            </div>

            {/* Academic Information Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                    <path d="M6 6h10" />
                    <path d="M6 10h10" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Academic Information
                </h2>
              </div>

              {/* 6 Grid Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* 1. Semester */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Semester
                  </span>
                  <span className="block text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedStudent.semester ?? 5}
                  </span>
                </div>

                {/* 2. Branch / Course */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Branch / Course
                  </span>
                  <span className="block text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedStudent.branch || "CSE"}
                  </span>
                </div>

                {/* 3. Section */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Section
                  </span>
                  <span className="block text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedStudent.section || "A"}
                  </span>
                </div>

                {/* 4. USN */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    USN
                  </span>
                  <span className="block text-base font-bold text-slate-900 dark:text-white mt-1 font-mono">
                    {selectedStudent.usn || "—"}
                  </span>
                </div>

                {/* 5. Email ID */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Email ID
                  </span>
                  <span className="block text-base font-bold text-slate-900 dark:text-white mt-1 truncate">
                    {selectedStudent.email}
                  </span>
                </div>

                {/* 6. Status */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Status
                  </span>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Details Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Additional Details
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Full Name
                  </span>
                  <span className="block text-base font-bold text-slate-900 dark:text-white mt-1">
                    {getStudentName(selectedStudent)}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
                  <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Date of Registration
                  </span>
                  <span className="block text-base font-bold text-slate-900 dark:text-white mt-1">
                    {getRegistrationDate(selectedStudent.created_at || selectedStudent.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             IMAGE 1: MANAGE STUDENTS LIST VIEW
             ========================================================================= */
          <div className="space-y-6">
            {/* Hero Greeting Card */}
            <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-100/70 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-900 border border-blue-100/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6 overflow-hidden">
              <div className="relative z-10">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  STUDENTS
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                  Manage Students
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
                  View and manage all registered students in your classes.
                </p>
              </div>

              <div className="relative z-10 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCreatedInfo(null);
                    setAddModalOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all"
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
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  <span>Add Student</span>
                </button>
              </div>
            </div>

            {/* Search & Filter Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
              {/* Search input with leading icon */}
              <div className="relative w-full sm:w-80">
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
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by name, USN or email..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all"
                />
              </div>

              {/* Filter Dropdowns */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Semester */}
                <select
                  value={selectedSemester}
                  onChange={(e) => {
                    setSelectedSemester(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="All">Semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>

                {/* Course / Branch */}
                <select
                  value={selectedCourse}
                  onChange={(e) => {
                    setSelectedCourse(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="All">Course</option>
                  {["CSE", "ISE", "ECE", "EEE", "MECH", "CIVIL", "AI&DS"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Section */}
                <select
                  value={selectedSection}
                  onChange={(e) => {
                    setSelectedSection(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="All">Section</option>
                  {["A", "B", "C", "D"].map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>

                {/* Reset button */}
                {(selectedSemester !== "All" ||
                  selectedCourse !== "All" ||
                  selectedSection !== "All" ||
                  searchQuery.trim() !== "") && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span>🔄</span>
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Students Table Card matching Image 1 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-4">USN</th>
                      <th className="py-3.5 px-4">Email ID</th>
                      <th className="py-3.5 px-4">Semester</th>
                      <th className="py-3.5 px-4">Branch</th>
                      <th className="py-3.5 px-4">Section</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No students found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedStudents.map((s, index) => {
                        const globalIndex = (currentPage - 1) * PAGE_SIZE + index + 1;
                        const avatarClass =
                          AVATAR_PALETTES[index % AVATAR_PALETTES.length];
                        const name = getStudentName(s);

                        return (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedStudent(s)}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                          >
                            {/* # */}
                            <td className="py-4 px-4 text-center text-slate-400 font-medium text-xs">
                              {globalIndex}
                            </td>

                            {/* Name + Colored Avatar */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${avatarClass}`}
                                >
                                  {name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                  {name}
                                </span>
                              </div>
                            </td>

                            {/* USN */}
                            <td className="py-4 px-4 font-mono text-slate-600 dark:text-slate-300">
                              {s.usn || "—"}
                            </td>

                            {/* Email ID */}
                            <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                              {s.email}
                            </td>

                            {/* Semester */}
                            <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                              {s.semester ?? 5}
                            </td>

                            {/* Branch */}
                            <td className="py-4 px-4 font-semibold text-slate-700 dark:text-slate-300">
                              {s.branch || "CSE"}
                            </td>

                            {/* Section */}
                            <td className="py-4 px-4 font-semibold text-slate-700 dark:text-slate-300">
                              {s.section || "A"}
                            </td>

                            {/* Actions Column */}
                            <td
                              className="py-4 px-4 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-2 relative">
                                {/* Three-dots menu button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActionMenuStudentId(
                                      actionMenuStudentId === s.id ? null : s.id
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Actions"
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
                                    <circle cx="19" cy="12" r="1" />
                                    <circle cx="5" cy="12" r="1" />
                                  </svg>
                                </button>

                                {/* Dropdown menu */}
                                {actionMenuStudentId === s.id && (
                                  <div className="absolute right-8 top-0 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 text-left text-xs divide-y divide-slate-100 dark:divide-slate-800">
                                    <div className="py-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedStudent(s);
                                          setActionMenuStudentId(null);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                      >
                                        View Profile
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedStudent(s);
                                          openEditModalForStudent(s);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                      >
                                        Edit Details
                                      </button>
                                    </div>
                                    <div className="py-1">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteStudent(s.id)}
                                        className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                      >
                                        Delete Student
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Chevron Arrow to open profile */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudent(s)}
                                  className="p-1 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all"
                                  title="View student profile"
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
                                    <polyline points="9 18 15 12 9 6" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination matching Image 1 */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                <span>
                  Showing{" "}
                  {filteredStudents.length === 0
                    ? 0
                    : (currentPage - 1) * PAGE_SIZE + 1}{" "}
                  –{" "}
                  {Math.min(currentPage * PAGE_SIZE, filteredStudents.length)} of{" "}
                  {filteredStudents.length} students
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                    aria-label="Previous page"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>

                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm"
                            : "border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                    aria-label="Next page"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
         ADD STUDENT MODAL
         ========================================================================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Add New Student
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register a student account and assign academic credentials
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {addError}
              </div>
            )}

            {createdInfo && (
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 space-y-1">
                <span className="font-bold block">✓ Student Created Successfully!</span>
                <p>
                  Account generated for <span className="font-semibold">{createdInfo.name}</span>.
                </p>
                <div className="mt-2 p-2 rounded-lg bg-white border border-emerald-300 font-mono text-emerald-900 select-all">
                  Password: {createdInfo.password}
                </div>
              </div>
            )}

            <form onSubmit={handleAddStudent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  placeholder="Aditya Kulkarni"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    required
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="aditya.k@bmsit.in"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    USN
                  </label>
                  <input
                    type="text"
                    value={addForm.usn}
                    onChange={(e) => setAddForm({ ...addForm, usn: e.target.value })}
                    placeholder="1BM23CS001"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Semester
                  </label>
                  <select
                    value={addForm.semester}
                    onChange={(e) => setAddForm({ ...addForm, semester: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch
                  </label>
                  <input
                    required
                    type="text"
                    value={addForm.branch}
                    onChange={(e) => setAddForm({ ...addForm, branch: e.target.value.toUpperCase() })}
                    placeholder="CSE"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Section
                  </label>
                  <input
                    required
                    type="text"
                    value={addForm.section}
                    onChange={(e) => setAddForm({ ...addForm, section: e.target.value.toUpperCase() })}
                    placeholder="A"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Temporary Password (optional; auto-generated if blank)
                </label>
                <input
                  type="text"
                  value={addForm.temporaryPassword}
                  onChange={(e) => setAddForm({ ...addForm, temporaryPassword: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm shadow-md transition-colors disabled:opacity-50"
                >
                  {addLoading ? "Creating…" : "Save Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
         EDIT STUDENT MODAL
         ========================================================================= */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Edit Student Details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modify academic and credential information
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditStudent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  USN
                </label>
                <input
                  type="text"
                  value={editForm.usn}
                  onChange={(e) => setEditForm({ ...editForm, usn: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Semester
                  </label>
                  <select
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch
                  </label>
                  <input
                    required
                    type="text"
                    value={editForm.branch}
                    onChange={(e) => setEditForm({ ...editForm, branch: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Section
                  </label>
                  <input
                    required
                    type="text"
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reset Password (optional; leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editForm.temporaryPassword}
                  onChange={(e) => setEditForm({ ...editForm, temporaryPassword: e.target.value })}
                  placeholder="New temporary password"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-xl text-sm shadow-md transition-colors disabled:opacity-50"
                >
                  {editLoading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Exam Modal */}
      {createExamModalOpen && (
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
                onClick={() => setCreateExamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Link
                to="/sets/new-mcq"
                onClick={() => setCreateExamModalOpen(false)}
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
                onClick={() => setCreateExamModalOpen(false)}
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
