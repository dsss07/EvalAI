-- Migration: Add grace_period_minutes and enforce single submission per question

-- 1. Ensure grace_period_minutes column exists on question_sets with default 5 minutes
ALTER TABLE question_sets 
ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER NOT NULL DEFAULT 5;

-- 2. Safely remove duplicate submissions for the same student and question, preserving the latest record
DELETE FROM submissions a USING submissions b
WHERE a.student_id = b.student_id 
  AND a.question_id = b.question_id 
  AND a.submitted_at < b.submitted_at;

-- In the event submitted_at timestamps are identical, tiebreak by id
DELETE FROM submissions a USING submissions b
WHERE a.student_id = b.student_id 
  AND a.question_id = b.question_id 
  AND a.id < b.id;

-- 3. Idempotently create the unique constraint on (student_id, question_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uk_submissions_student_question'
    ) THEN
        ALTER TABLE submissions ADD CONSTRAINT uk_submissions_student_question UNIQUE (student_id, question_id);
    END IF;
END $$;
