export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "teacher" | "student";
  usn?: string;
  semester?: number;
  section?: string;
  branch?: string;
  created_at: string;
}

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  grading_mode: "easy" | "mid" | "hard";
  test_type?: "DESCRIPTIVE" | "MCQ";
  status?: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  semester: number;
  section: string;
  branch: string;
  subject?: string;
  teacher_id: string;
  created_at: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  grace_period_minutes?: number;
}

export interface Question {
  id: string;
  set_id?: string;
  question_text: string;
  answer_key?: string;
  rubric?: string;
  max_marks: number;
  order?: number;
  options?: Record<string, string>;
}

export interface StudentAssessmentStatus {
  setId: string;
  state: "UPCOMING" | "OPEN" | "SUBMITTED" | "CLOSED";
  startTime?: string | null;
  endTime?: string | null;
  serverTime?: string | null;
  gracePeriodMinutes: number;
  submitted: boolean;
  submittedAt?: string | null;
  gradingStatus?: string | null;
  fileUrls?: string[];
}

export interface QuestionSetDetail extends QuestionSet {
  questions: Question[];
  teacher_name?: string;
}

export interface Grade {
  id: string;
  grader_type: "ai" | "teacher";
  grader_id?: string;
  score: number;
  max_score: number;
  mode?: "easy" | "mid" | "hard";
  breakdown?: Record<string, unknown>;
  created_at: string;
}

export interface Submission {
  id: string;
  question_id: string;
  student_id: string;
  answer_text: string;
  submitted_at: string;
  grades: Grade[];
  student_name?: string;
  student_usn?: string;
  student_branch?: string;
  question_text?: string;
  image_url?: string | null;
  needs_review?: boolean;
  is_final?: boolean;
}

export interface StudentResult {
  student_id: string;
  student_name: string;
  student_usn?: string;
  total_score: number;
  max_score: number;
  status: string;
  is_final: boolean;
}

export interface MCQAnswerDetail {
  question_id: string;
  question_text: string;
  options: Record<string, string>;
  selected_option: string | null;
  correct_option: string;
  is_correct: boolean;
  marks_awarded: number;
  max_marks: number;
  is_grace_awarded: boolean;
}

export interface DescriptiveAnswerDetail {
  question_id: string;
  question_number: number;
  question_text: string;
  max_marks: number;
  student_answer: string;
  image_url?: string | null;
  score_awarded: number;
  ai_feedback?: string;
  missing_concepts?: string[];
  teacher_remarks?: string;
  is_final: boolean;
}

export interface MyResult {
  set_id: string;
  set_title: string;
  subject?: string;
  total_score: number;
  max_score: number;
  is_final: boolean;
  test_type?: "DESCRIPTIVE" | "MCQ";
  submitted_at?: string;
  status?: string;
  mcq_answers?: MCQAnswerDetail[];
  descriptive_answers?: DescriptiveAnswerDetail[];
}

export interface SubmissionProgressEvent {
  submissionId?: string | null;
  questionSetId?: string | null;
  stage: "QUEUED" | "OCR_IN_PROGRESS" | "OCR_COMPLETED" | "SCORING_IN_PROGRESS" | "GRADED" | "FAILED" | string;
  progressPercentage: number;
  message: string;
  timestamp: string;
}

export type ReportStatus = "PENDING" | "RESOLVED" | "REJECTED";

export interface EvaluationReport {
  id: string;
  studentId?: string;
  student_id?: string;
  studentName?: string;
  student_name?: string;
  studentUsn?: string;
  student_usn?: string;
  studentEmail?: string;
  student_email?: string;
  setId?: string;
  set_id?: string;
  setTitle?: string;
  set_title?: string;
  subject?: string;
  submissionId?: string | null;
  submission_id?: string | null;
  questionNumber?: number | null;
  question_number?: number | null;
  reason: string;
  status: ReportStatus;
  resolutionRemarks?: string | null;
  resolution_remarks?: string | null;
  createdAt?: string;
  created_at?: string;
  resolvedAt?: string | null;
  resolved_at?: string | null;
}

export interface CreateReportRequest {
  setId?: string;
  set_id?: string;
  submissionId?: string | null;
  submission_id?: string | null;
  questionNumber?: number | null;
  question_number?: number | null;
  reason: string;
}

export interface ResolveReportRequest {
  status?: ReportStatus;
  resolutionRemarks?: string;
  resolution_remarks?: string;
}
