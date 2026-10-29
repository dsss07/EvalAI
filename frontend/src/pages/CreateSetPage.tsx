import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";

export default function CreateSetPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    semester: 1,
    section: "A",
    branch: "CSE",
    subject: "",
    grading_mode: "mid",
  });
  const [questions, setQuestions] = useState([
    { question_text: "", answer_key: "", rubric: "", max_marks: 10 },
  ]);
  const [authoringMode, setAuthoringMode] = useState<"manual" | "upload">("manual");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(5);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [eligibleStudentIds, setEligibleStudentIds] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [extractionNotice, setExtractionNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/teacher/students")
      .then(({ data }) => setStudents(data))
      .catch(() => {});
  }, []);

  const update = (key: string, val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }));

  const updateQ = (i: number, key: string, val: string | number) => {
    setQuestions((qs) =>
      qs.map((q, j) => (j === i ? { ...q, [key]: val } : q))
    );
  };

  const addQuestion = () =>
    setQuestions((qs) => [
      ...qs,
      { question_text: "", answer_key: "", rubric: "", max_marks: 10 },
    ]);

  const removeQuestion = (i: number) =>
    setQuestions((qs) => qs.filter((_, j) => j !== i));

  const filteredStudents = students.filter(
    (student) =>
      Number(student.semester) === Number(form.semester) &&
      String(student.branch || "").toUpperCase() === form.branch.toUpperCase() &&
      String(student.section || "").toUpperCase() === form.section.toUpperCase()
  );

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredStudents.map((s) => s.id);
    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => eligibleStudentIds.includes(id));
    if (allSelected) {
      setEligibleStudentIds((prev) =>
        prev.filter((id) => !filteredIds.includes(id))
      );
    } else {
      setEligibleStudentIds((prev) =>
        Array.from(new Set([...prev, ...filteredIds]))
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (eligibleStudentIds.length === 0) {
      setError(
        "Please select at least one eligible student before creating the assessment."
      );
      return;
    }

    if (startTime && endTime) {
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();
      if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
        setError("Assessment End Time must be strictly after Start Time.");
        return;
      }
    }

    if (gracePeriodMinutes < 0) {
      setError("Grace period minutes cannot be negative.");
      return;
    }

    const validQuestions = questions
      .map((q) => ({
        question_text: q.question_text.trim(),
        answer_key: q.answer_key.trim(),
        rubric: (q.rubric || "").trim(),
        max_marks: Number(q.max_marks) || 0,
      }))
      .filter((q) => q.question_text && q.answer_key && q.max_marks > 0);

    if (validQuestions.length === 0) {
      setError(
        "Please provide at least one valid question with question text, model answer, and positive max marks."
      );
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, any> = {
        ...form,
        eligible_student_ids: eligibleStudentIds,
        grace_period_minutes: Number(gracePeriodMinutes) || 5,
      };
      if (startTime) {
        payload.start_time = new Date(startTime).toISOString();
      }
      if (endTime) {
        payload.end_time = new Date(endTime).toISOString();
      }

      const { data: qs } = await api.post("/api/question-sets", payload);

      // Add questions sequentially
      for (let i = 0; i < validQuestions.length; i++) {
        const q = validQuestions[i];
        await api.post(`/api/question-sets/${qs.id}/questions`, {
          question_text: q.question_text,
          answer_key: q.answer_key,
          rubric: q.rubric || undefined,
          max_marks: q.max_marks,
          order: i + 1,
        });
      }
      navigate(`/sets/${qs.id}`);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          "Failed to create question set"
      );
    } finally {
      setLoading(false);
    }
  };

  const extractAnswerKey = async (file?: File) => {
    if (!file) return;
    setError("");
    setExtractionWarnings([]);
    setExtractionNotice("");
    setExtracting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await api.post("/api/answer-key/extract", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const extracted = (data.items || []).map((item: any) => ({
        question_text: item.question_text || "",
        answer_key: item.answer_text || "",
        rubric: item.rubric || "",
        max_marks: item.max_marks || 10,
      }));
      if (extracted.length) {
        setQuestions(extracted);
        setExtractionNotice(
          `Extracted ${extracted.length} question(s) successfully! You can review, edit, and fine-tune them below before creating the assessment.`
        );
      } else {
        setExtractionNotice(
          "No numbered questions were detected in the document. Please enter the questions manually."
        );
      }
      setExtractionWarnings(data.warnings || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "Could not extract the Word answer key. Check that the Python service is running."
      );
    } finally {
      setExtracting(false);
    }
  };

  const modeDescriptions: Record<string, string> = {
    easy: "Generous similarity threshold, partial keyword matching",
    mid: "Balanced — checks both keyword presence and semantic similarity",
    hard: "Strict thresholds, requires most key concepts present",
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
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
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Create Descriptive Exam
          </span>
        </div>

        {/* Page Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-2 uppercase tracking-wider">
            Descriptive Evaluation
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Create Question Set
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Define questions, model answers, and evaluation rules for AI-assisted handwritten answer script grading.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 px-4 py-3.5 rounded-xl text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Set Details Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Assessment Metadata
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Assessment Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="set-title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="e.g., Data Structures Midterm Examination"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Description / Instructions
              </label>
              <textarea
                id="set-description"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                placeholder="Optional instructions for students..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Semester <span className="text-rose-500">*</span>
                </label>
                <input
                  id="set-semester"
                  type="number"
                  min="1"
                  max="8"
                  value={form.semester}
                  onChange={(e) =>
                    update("semester", parseInt(e.target.value) || 1)
                  }
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Section <span className="text-rose-500">*</span>
                </label>
                <input
                  id="set-section"
                  type="text"
                  maxLength={1}
                  value={form.section}
                  onChange={(e) =>
                    update("section", e.target.value.toUpperCase())
                  }
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="e.g. A"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="set-subject"
                  type="text"
                  value={form.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="e.g. Database Systems"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Branch / Department <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "CSE",
                  "AIML",
                  "ECE",
                  "CSBS",
                  "ETE",
                  "CIVIL",
                  "MEC",
                  "ISE",
                ].map((branch) => (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => update("branch", branch)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      form.branch === branch
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400"
                    }`}
                  >
                    {branch}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                AI Grading Mode
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(["easy", "mid", "hard"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => update("grading_mode", mode)}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold capitalize transition-all border ${
                      form.grading_mode === mode
                        ? "bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                ℹ️ {modeDescriptions[form.grading_mode]}
              </p>
            </div>
          </div>

          {/* Schedule & Submission Window Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Exam Schedule & Submission Window
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Submissions outside this window are automatically time-gated.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="set-start-time"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Start Time
                </label>
                <input
                  id="set-start-time"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="set-end-time"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  End Time (Deadline)
                </label>
                <input
                  id="set-end-time"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="max-w-xs">
              <label
                htmlFor="set-grace-period"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Grace Period (Minutes)
              </label>
              <input
                id="set-grace-period"
                type="number"
                min="0"
                value={gracePeriodMinutes}
                onChange={(e) =>
                  setGracePeriodMinutes(Math.max(0, parseInt(e.target.value) || 0))
                }
                required
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Extra minutes permitted after deadline for scan & upload latency.
              </p>
            </div>
          </div>

          {/* Eligible Students Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Eligible Students
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Showing registered students in Semester {form.semester}, {form.branch}, Section {form.section}.
                </p>
              </div>
              {filteredStudents.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {filteredStudents.every((s) => eligibleStudentIds.includes(s.id))
                    ? "Deselect All"
                    : "Select All Matching"}
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-100 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30">
              {filteredStudents.map((student) => (
                <label
                  key={student.id}
                  className="flex gap-3 items-center rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800/70 p-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:border-blue-400 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={eligibleStudentIds.includes(student.id)}
                    onChange={(e) =>
                      setEligibleStudentIds((ids) =>
                        e.target.checked
                          ? [...ids, student.id]
                          : ids.filter((id) => id !== student.id)
                      )
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">{student.full_name || student.fullName}</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {student.usn || student.email}
                  </span>
                </label>
              ))}

              {filteredStudents.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 p-3 text-center">
                  No registered students match these academic parameters. Adjust semester/branch/section or register students first.
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Selected students: <span className="text-blue-600 font-bold">{eligibleStudentIds.length}</span>
            </p>
          </div>

          {/* Question & Answer Key Authoring Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Questions & Answer Keys
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Type questions manually or extract from a Word (.docx) answer key.
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAuthoringMode("manual")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    authoringMode === "manual"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>✏️</span>
                  <span>Manual Entry</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthoringMode("upload")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    authoringMode === "upload"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>📄</span>
                  <span>Upload .docx</span>
                </button>
              </div>
            </div>

            {/* Mode B: Upload Document */}
            {authoringMode === "upload" && (
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Extract from Word Document (.docx)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload a numbered .docx answer key file. The Python extraction pipeline will parse question-answer pairs and populate the editable cards below.
                </p>

                <input
                  type="file"
                  accept=".docx"
                  disabled={extracting}
                  onChange={(e) => extractAnswerKey(e.target.files?.[0])}
                  className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50"
                />

                {extracting && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 font-medium pt-1">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Extracting questions and model answers…</span>
                  </div>
                )}
                {extractionNotice && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-3.5 py-2 rounded-lg text-xs font-medium">
                    {extractionNotice}
                  </div>
                )}
                {extractionWarnings.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-3.5 py-2 rounded-lg text-xs space-y-1">
                    {extractionWarnings.map((warning, index) => (
                      <p key={index}>⚠️ {warning}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Question Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {questions.length} Question{questions.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <span>+ Add Question</span>
                </button>
              </div>

              {questions.map((q, i) => (
                <div
                  key={i}
                  className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 rounded-xl p-5 space-y-3.5 hover:border-blue-400/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wide">
                      QUESTION {i + 1}
                    </span>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(i)}
                        className="text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Question Prompt <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={q.question_text}
                      onChange={(e) =>
                        updateQ(i, "question_text", e.target.value)
                      }
                      rows={2}
                      required
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      placeholder="Enter question text here..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Model Answer / Evaluation Criteria{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={q.answer_key}
                      onChange={(e) => updateQ(i, "answer_key", e.target.value)}
                      rows={3}
                      required
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      placeholder="The standard answer against which students' OCR answers will be evaluated..."
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Grading Rubric / Marking Scheme (Optional)
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Criterion-by-criterion marks for LLM grading
                      </span>
                    </div>
                    <textarea
                      value={q.rubric || ""}
                      onChange={(e) => updateQ(i, "rubric", e.target.value)}
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      placeholder="e.g., Definition: 1M, Formula & Variables: 2M, Example: 2M"
                    />
                  </div>

                  <div className="w-36">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Max Marks <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={q.max_marks}
                      onChange={(e) =>
                        updateQ(i, "max_marks", parseInt(e.target.value) || 0)
                      }
                      min={1}
                      required
                      className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating Assessment...</span>
              </>
            ) : (
              "Create Question Set"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
