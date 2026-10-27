package com.example.answereval.repository;

import com.example.answereval.entity.MCQQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface MCQQuestionRepository extends JpaRepository<MCQQuestion, UUID> {
    List<MCQQuestion> findByQuestionSetId(UUID setId);
}
