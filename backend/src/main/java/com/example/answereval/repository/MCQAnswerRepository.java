package com.example.answereval.repository;

import com.example.answereval.entity.MCQAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface MCQAnswerRepository extends JpaRepository<MCQAnswer, UUID> {
    List<MCQAnswer> findByQuestionSetIdAndStudentId(UUID setId, UUID studentId);
    List<MCQAnswer> findByQuestionSetId(UUID setId);
    boolean existsByQuestionSetIdAndStudentId(UUID setId, UUID studentId);
    List<MCQAnswer> findByStudentId(UUID studentId);
}
