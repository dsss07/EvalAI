package com.example.answereval.repository;

import com.example.answereval.entity.QuestionSet;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface QuestionSetRepository extends JpaRepository<QuestionSet, UUID> {
    List<QuestionSet> findByTeacherIdOrderByCreatedAtDesc(UUID teacherId);
}
