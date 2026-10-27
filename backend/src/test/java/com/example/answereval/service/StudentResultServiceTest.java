package com.example.answereval.service;

import com.example.answereval.entity.*;
import com.example.answereval.repository.MCQAnswerRepository;
import com.example.answereval.repository.MCQQuestionRepository;
import com.example.answereval.repository.SubmissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentResultServiceTest {

    @Mock
    private SubmissionRepository submissionRepository;

    @Mock
    private MCQAnswerRepository mcqAnswerRepository;

    @Mock
    private MCQQuestionRepository mcqQuestionRepository;

    private StudentResultService studentResultService;

    private User student;

    private void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @BeforeEach
    void setUp() {
        studentResultService = new StudentResultService(
                submissionRepository,
                mcqAnswerRepository,
                mcqQuestionRepository
        );

        student = new User();
        setField(student, "id", UUID.randomUUID());
        student.setEmail("student@example.com");
    }

    @Test
    @SuppressWarnings("unchecked")
    void results_includesDescriptiveQuestionBreakdownAndAiFeedback() {
        UUID setId = UUID.randomUUID();
        QuestionSet set = new QuestionSet();
        setField(set, "id", setId);
        set.setTitle("Data Structures Exam");
        set.setSubject("Computer Science");
        set.setTestType(TestType.DESCRIPTIVE);
        set.setStatus(TestStatus.COMPLETED);

        Question q1 = new Question();
        setField(q1, "id", UUID.randomUUID());
        q1.setQuestionSet(set);
        q1.setQuestionText("Explain binary search trees.");
        q1.setMaxMarks(10);
        q1.setQuestionOrder(1);

        Question q2 = new Question();
        setField(q2, "id", UUID.randomUUID());
        q2.setQuestionSet(set);
        q2.setQuestionText("What is time complexity of QuickSort?");
        q2.setMaxMarks(5);
        q2.setQuestionOrder(2);

        set.getQuestions().add(q1);
        set.getQuestions().add(q2);

        Submission sub1 = new Submission();
        setField(sub1, "id", UUID.randomUUID());
        sub1.setQuestion(q1);
        sub1.setStudent(student);
        sub1.setAnswerText("A binary search tree is a node-based binary tree.");
        sub1.setFinalSubmission(true);

        Grade aiGrade1 = new Grade();
        setField(aiGrade1, "id", UUID.randomUUID());
        aiGrade1.setGraderType(GraderType.AI);
        aiGrade1.setScore(8.5);
        aiGrade1.setMaxScore(10.0);
        Map<String, Object> breakdown = new HashMap<>();
        breakdown.put("feedback", "Good definition, but missed balancing properties.");
        breakdown.put("missing_concepts", List.of("AVL balancing", "worst case O(n)"));
        aiGrade1.setBreakdown(breakdown);
        sub1.getGrades().add(aiGrade1);

        when(submissionRepository.findByStudentIdOrderBySubmittedAtDesc(student.getId()))
                .thenReturn(List.of(sub1));
        when(mcqAnswerRepository.findByStudentId(student.getId()))
                .thenReturn(Collections.emptyList());

        List<Map<String, Object>> results = studentResultService.results(student);

        assertNotNull(results);
        assertEquals(1, results.size());

        Map<String, Object> setResult = results.get(0);
        assertEquals(setId, setResult.get("set_id"));
        assertEquals("Data Structures Exam", setResult.get("set_title"));
        assertEquals("Computer Science", setResult.get("subject"));
        assertEquals(8.5, setResult.get("total_score"));
        assertEquals(15.0, setResult.get("max_score"));
        assertEquals("DESCRIPTIVE", setResult.get("test_type"));

        List<Map<String, Object>> descriptiveAnswers = (List<Map<String, Object>>) setResult.get("descriptive_answers");
        assertNotNull(descriptiveAnswers);
        assertEquals(2, descriptiveAnswers.size());

        Map<String, Object> ans1 = descriptiveAnswers.get(0);
        assertEquals(q1.getId(), ans1.get("question_id"));
        assertEquals(1, ans1.get("question_number"));
        assertEquals("Explain binary search trees.", ans1.get("question_text"));
        assertEquals("A binary search tree is a node-based binary tree.", ans1.get("student_answer"));
        assertEquals(8.5, ans1.get("score_awarded"));
        assertEquals("Good definition, but missed balancing properties.", ans1.get("ai_feedback"));
        assertEquals(List.of("AVL balancing", "worst case O(n)"), ans1.get("missing_concepts"));

        Map<String, Object> ans2 = descriptiveAnswers.get(1);
        assertEquals(q2.getId(), ans2.get("question_id"));
        assertEquals(2, ans2.get("question_number"));
        assertEquals(0.0, ans2.get("score_awarded"));
        assertEquals("No submission was recorded for this question.", ans2.get("ai_feedback"));
    }
}
