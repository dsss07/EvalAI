package com.example.answereval.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "mcq_questions")
public class MCQQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_set_id", nullable = false)
    private QuestionSet questionSet;

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, String> options;

    @Column(name = "correct_option", nullable = false, length = 10)
    private String correctOption;

    @Column(nullable = false)
    private double marks = 1.0;

    @Column(name = "is_grace_awarded", nullable = false)
    private boolean graceAwarded;

    public UUID getId() { return id; }
    public QuestionSet getQuestionSet() { return questionSet; }
    public void setQuestionSet(QuestionSet questionSet) { this.questionSet = questionSet; }
    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }
    public Map<String, String> getOptions() { return options; }
    public void setOptions(Map<String, String> options) { this.options = options; }
    public String getCorrectOption() { return correctOption; }
    public void setCorrectOption(String correctOption) { this.correctOption = correctOption; }
    public double getMarks() { return marks; }
    public void setMarks(double marks) { this.marks = marks; }
    public boolean isGraceAwarded() { return graceAwarded; }
    public void setGraceAwarded(boolean graceAwarded) { this.graceAwarded = graceAwarded; }
}
