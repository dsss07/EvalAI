package com.example.answereval.repository;

import com.example.answereval.entity.Grade;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface GradeRepository extends JpaRepository<Grade, UUID> {
    List<Grade> findBySubmissionIdOrderByCreatedAtDesc(UUID submissionId);
}
