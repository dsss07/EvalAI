package com.example.answereval.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class DatabaseSchemaInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSchemaInitializer.class);
    private final JdbcTemplate jdbcTemplate;

    public DatabaseSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            log.info("Checking database schema updates for question_sets and submissions...");

            // 1. Ensure grace_period_minutes column exists on question_sets
            jdbcTemplate.execute(
                    "ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER NOT NULL DEFAULT 5"
            );

            // 2. Remove duplicate submissions before creating constraint
            jdbcTemplate.execute(
                    "DELETE FROM submissions a USING submissions b " +
                    "WHERE a.student_id = b.student_id AND a.question_id = b.question_id AND a.submitted_at < b.submitted_at"
            );

            // 3. Ensure unique constraint on (student_id, question_id)
            jdbcTemplate.execute(
                    "DO $$ " +
                    "BEGIN " +
                    "    IF NOT EXISTS ( " +
                    "        SELECT 1 FROM pg_constraint WHERE conname = 'uk_submissions_student_question' " +
                    "    ) THEN " +
                    "        ALTER TABLE submissions ADD CONSTRAINT uk_submissions_student_question UNIQUE (student_id, question_id); " +
                    "    END IF; " +
                    "END $$;"
            );

            log.info("Database schema updates verified successfully.");
        } catch (Exception ex) {
            log.warn("Database schema update check skipped or encountered note: {}", ex.getMessage());
        }
    }
}
