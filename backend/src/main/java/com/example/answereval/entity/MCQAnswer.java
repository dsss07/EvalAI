package com.example.answereval.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "mcq_answers")
public class MCQAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_set_id", nullable = false)
    private QuestionSet questionSet;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private MCQQuestion question;

    @Column(name = "selected_option", length = 10)
    private String selectedOption;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(name = "marks_awarded", nullable = false)
    private double marksAwarded;

    @Column(name = "submitted_at", nullable = false)
    private OffsetDateTime submittedAt = OffsetDateTime.now();

    public UUID getId() { return id; }
    public QuestionSet getQuestionSet() { return questionSet; }
    public void setQuestionSet(QuestionSet questionSet) { this.questionSet = questionSet; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public MCQQuestion getQuestion() { return question; }
    public void setQuestion(MCQQuestion question) { this.question = question; }
    public String getSelectedOption() { return selectedOption; }
    public void setSelectedOption(String selectedOption) { this.selectedOption = selectedOption; }
    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean correct) { this.correct = correct; }
    public double getMarksAwarded() { return marksAwarded; }
    public void setMarksAwarded(double marksAwarded) { this.marksAwarded = marksAwarded; }
    public OffsetDateTime getSubmittedAt() { return submittedAt; }
}
