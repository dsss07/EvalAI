import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";

export default function TeacherMCQPage() {
  const navigate = useNavigate();

  // Phase 1: Upload
  const [form, setForm] = useState({
    title: "",
    description: "MCQ Exam",
    semester: 1,
    section: "A",
    branch: "CSE",
    grading_mode: "mid",
    test_type: "MCQ",
  });
  const [file, setFile] = useState<File | null>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questionSetId, setQuestionSetId] = useState<string | null>(null);

  // Phase 2: Review
  const [questions, setQuestions] = useState<any[]>([]);

  // Phase 3: Activation
  const [activation, setActivation] = useState({
    start_time: "",
    end_time: "",
    duration_minutes: 30,
  });

  const updateForm = (key: string, val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF file.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // 1. Create QuestionSet
      const { data: qsData } = await api.post("/api/question-sets", form);
      const qsId = qsData.id;
      setQuestionSetId(qsId);

      // 2. Upload PDF for extraction
      const formData = new FormData();
      formData.append("file", file);

      const { data: extractedQs } = await api.post(
        `/api/question-sets/${qsId}/extract-mcqs`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setQuestions(extractedQs);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "Failed to process PDF."
      );
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = async (qId: string, updates: any) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, ...updates } : q))
    );

    try {
      const question = questions.find((q) => q.id === qId);
      if (!question) return;
      const payload = { ...question, ...updates };
      await api.put(
        `/api/question-sets/${questionSetId}/mcq-questions/${qId}`,
        payload
      );
    } catch (err) {
      console.error("Failed to update question:", err);
    }
  };

  const updateOption = (qId: string, optionKey: string, value: string) => {
    const question = questions.find((q) => q.id === qId);
    if (!question) return;
    updateQuestion(qId, {
      options: { ...question.options, [optionKey]: value },
    });
  };

  const deleteQuestion = async (qId: string) => {
    try {
      await api.delete(
        `/api/question-sets/${questionSetId}/mcq-questions/${qId}`
      );
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
    } catch (err) {
      console.error("Failed to delete question:", err);
    }
  };

  const handlePublish = async () => {
    if (!activation.start_time || !activation.end_time) {
      setError("Start time and end time are required to publish the exam.");
      return;
    }

    try {
      setError("");
      await api.post(`/api/question-sets/${questionSetId}/publish`, {
        start_time: new Date(activation.start_time).toISOString(),
        end_time: new Date(activation.end_time).toISOString(),
        duration_minutes: Number(activation.duration_minutes),
      });
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to publish exam.");
    }
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
            Create MCQ Exam (PDF)
          </span>
        </div>

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-2 uppercase tracking-wider">
            Automated PDF Extraction
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            MCQ Exam Workspace
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Upload question paper PDFs, automatically extract questions via Gemini Vision AI, and publish online tests.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 px-4 py-3.5 rounded-xl text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* PHASE 1: CONFIGURATION & UPLOAD */}
        {!questionSetId && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              1. Exam Configuration & PDF Source
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Exam Title <span className="text-rose-500">*</span>
                </label>
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="e.g. Physics Midterm MCQ"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Branch / Department <span className="text-rose-500">*</span>
                </label>
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                  value={form.branch}
                  onChange={(e) => updateForm("branch", e.target.value.toUpperCase())}
                  placeholder="e.g. CSE"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Semester <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={form.semester}
                  onChange={(e) => updateForm("semester", Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Section <span className="text-rose-500">*</span>
                </label>
                <input
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                  value={form.section}
                  onChange={(e) => updateForm("section", e.target.value.toUpperCase())}
                  placeholder="e.g. A"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Upload Question Paper (PDF) <span className="text-rose-500">*</span>
              </label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center bg-slate-50/50 dark:bg-slate-800/30 hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  id="pdf-upload"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="pdf-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl">
                    📄
                  </div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {file ? file.name : "Click to select or drag PDF file here"}
                  </span>
                  <span className="text-xs text-slate-400">
                    PDF questions and multiple choice options will be extracted automatically.
                  </span>
                </label>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={loading || !form.title || !file}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-xl font-semibold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Extracting MCQs with Gemini AI...</span>
                </>
              ) : (
                "Extract Questions from PDF"
              )}
            </button>
          </div>
        )}

        {/* PHASE 2: REVIEW & EDIT */}
        {questionSetId && questions.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  2. Review & Fine-tune Extracted Questions
                </h2>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {questions.length} Questions Extracted
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Verify each question prompt and select the correct radio option. Edits save automatically.
              </p>
            </div>

            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm relative group hover:border-blue-400/60 transition-colors space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Question Prompt
                    </span>
                  </div>

                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="text-xs text-rose-500 hover:text-rose-600 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    title="Delete Question"
                  >
                    ✕ Remove
                  </button>
                </div>

                <textarea
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y min-h-[70px]"
                  value={q.question_text}
                  onChange={(e) =>
                    updateQuestion(q.id, { question_text: e.target.value })
                  }
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {Object.keys(q.options || {}).map((optKey) => {
                    const isSelected = q.correct_option === optKey;
                    return (
                      <div
                        key={optKey}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-blue-50/70 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500"
                            : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          id={`correct-${q.id}-${optKey}`}
                          name={`correct-${q.id}`}
                          checked={isSelected}
                          onChange={() =>
                            updateQuestion(q.id, { correct_option: optKey })
                          }
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer ml-1"
                        />
                        <label
                          htmlFor={`correct-${q.id}-${optKey}`}
                          className="font-bold text-xs text-slate-500 dark:text-slate-400 w-5 cursor-pointer"
                        >
                          {optKey}
                        </label>
                        <input
                          className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
                          value={q.options[optKey]}
                          onChange={(e) =>
                            updateOption(q.id, optKey, e.target.value)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* PHASE 3: ACTIVATION & PUBLISH */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                3. Schedule & Publish Exam
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Start Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={activation.start_time}
                    onChange={(e) =>
                      setActivation({
                        ...activation,
                        start_time: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    End Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={activation.end_time}
                    onChange={(e) =>
                      setActivation({ ...activation, end_time: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Duration (Minutes) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={activation.duration_minutes}
                    onChange={(e) =>
                      setActivation({
                        ...activation,
                        duration_minutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <button
                onClick={handlePublish}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <span>🚀</span>
                <span>Publish Exam to Students</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
