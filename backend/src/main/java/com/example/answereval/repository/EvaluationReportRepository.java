package com.example.answereval.repository;

import com.example.answereval.entity.EvaluationReport;
import com.example.answereval.entity.ReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface EvaluationReportRepository extends JpaRepository<EvaluationReport, UUID> {

    @Query("SELECT r FROM EvaluationReport r JOIN FETCH r.student s JOIN FETCH r.questionSet qs WHERE qs.teacher.id = :teacherId ORDER BY r.createdAt DESC")
    List<EvaluationReport> findByTeacherId(@Param("teacherId") UUID teacherId);

    @Query("SELECT r FROM EvaluationReport r JOIN FETCH r.student s JOIN FETCH r.questionSet qs WHERE qs.teacher.id = :teacherId AND r.status = :status ORDER BY r.createdAt DESC")
    List<EvaluationReport> findByTeacherIdAndStatus(@Param("teacherId") UUID teacherId, @Param("status") ReportStatus status);

    @Query("SELECT COUNT(r) FROM EvaluationReport r WHERE r.questionSet.teacher.id = :teacherId AND r.status = :status")
    long countByTeacherIdAndStatus(@Param("teacherId") UUID teacherId, @Param("status") ReportStatus status);

    List<EvaluationReport> findByStudentIdOrderByCreatedAtDesc(UUID studentId);

    List<EvaluationReport> findByQuestionSetIdAndStudentId(UUID questionSetId, UUID studentId);

    List<EvaluationReport> findBySubmissionId(UUID submissionId);

    List<EvaluationReport> findBySubmissionIdAndStatus(UUID submissionId, ReportStatus status);
}
