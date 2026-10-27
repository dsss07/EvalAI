package com.example.answereval.repository;

import com.example.answereval.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface SubmissionRepository extends JpaRepository<Submission, UUID> {
    List<Submission> findByQuestionQuestionSetIdOrderBySubmittedAtDesc(UUID setId);
    List<Submission> findByStudentIdOrderBySubmittedAtDesc(UUID studentId);
    boolean existsByStudentIdAndQuestionId(UUID studentId, UUID questionId);
    boolean existsByStudentIdAndQuestionQuestionSetId(UUID studentId, UUID setId);
    java.util.Optional<Submission> findByStudentIdAndQuestionId(UUID studentId, UUID questionId);
}
