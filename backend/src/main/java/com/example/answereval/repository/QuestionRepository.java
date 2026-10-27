package com.example.answereval.repository;

import com.example.answereval.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface QuestionRepository extends JpaRepository<Question, UUID> {
    List<Question> findByQuestionSetIdOrderByQuestionOrderAsc(UUID setId);
}
