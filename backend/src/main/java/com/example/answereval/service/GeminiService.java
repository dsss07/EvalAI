package com.example.answereval.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.content.Media;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.MimeTypeUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    public GeminiService(ChatClient.Builder chatClientBuilder, ObjectMapper objectMapper) {
        this.chatClient = chatClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    public Map<String, Map<String, Object>> parseFullScript(
            List<MediaInput> documents,
            List<QuestionContext> questions
    ) {
        StringBuilder questionContext = new StringBuilder();
        for (QuestionContext question : questions) {
            questionContext.append("Question ID: ")
                    .append(question.id())
                    .append(" | Number: ")
                    .append(question.number())
                    .append(" | Text: ")
                    .append(question.text())
                    .append("\n");
        }

        String prompt = """
                You are an expert at reading handwritten university answer scripts.
                Examine the attached exam document and map each attempted answer to the
                correct question from the supplied question list.

                Questions:
                %s

                Rules:
                1. Examine every page.
                2. Students may answer questions out of order.
                3. Recognize labels such as Q1, Q.1, Q-1, 1., 1), Ans 1 and similar forms.
                4. Use the question topic as well as the visible number when mapping an answer.
                5. Return the complete answer text you can read, without inventing missing text.
                6. If a question was not attempted, return attempted=false and an empty text.

                Return ONLY JSON in this structure:
                {
                  "results": [
                    {
                      "question_id": "...",
                      "text": "...",
                      "attempted": true,
                      "confidence": 0.0
                    }
                  ]
                }
                """.formatted(questionContext);

        try {
            log.info("Gemini full-script extraction started: files={}, questions={}", documents.size(), questions.size());
            String raw = callWithMedia(prompt, documents);
            if (raw == null || raw.isBlank()) {
                throw new IllegalStateException("Gemini returned an empty response");
            }
            log.info("Gemini full-script extraction returned text ({} chars)", raw.length());
            Map<String, Object> root = parseJson(raw);
            Map<String, Map<String, Object>> result = new HashMap<>();

            Object rawResults = root.get("results");
            if (rawResults instanceof List<?> results) {
                for (Object rawItem : results) {
                    if (!(rawItem instanceof Map<?, ?> item)) {
                        continue;
                    }

                    String questionId = String.valueOf(item.containsKey("question_id") ? item.get("question_id") : "");
                    if (questionId.isBlank()) {
                        continue;
                    }

                    Map<String, Object> mapped = new HashMap<>();
                    mapped.put("text", String.valueOf(item.containsKey("text") ? item.get("text") : ""));
                    mapped.put("attempted", Boolean.parseBoolean(String.valueOf(item.containsKey("attempted") ? item.get("attempted") : false)));
                    mapped.put("confidence", toDouble(item.get("confidence"), 0.0));
                    result.put(questionId, mapped);
                }
            }

            return result;
        } catch (Exception exception) {
            log.error("Gemini full-script extraction failed: {}", safeMessage(exception));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Gemini extraction failed. Check backend logs and GEMINI_MODEL configuration.", exception);
        }
    }

    public GradingResult grade(
            String questionText,
            String rubric,
            String studentAnswer,
            double maxMarks
    ) {
        return grade(questionText, rubric, studentAnswer, maxMarks, "standard");
    }

    public GradingResult grade(
            String questionText,
            String rubric,
            String studentAnswer,
            double maxMarks,
            String mode
    ) {
        boolean hasRubric = rubric != null && !rubric.trim().isEmpty();

        String rubricSection;
        if (hasRubric) {
            rubricSection = """
                    Marking Scheme / Rubric:
                    %s

                    Grading Guidelines:
                    1. You are an academic examiner grading strictly against the following Rubric / Marking Scheme.
                    2. Evaluate each criterion independently, awarding partial marks per criterion up to the maximum marks (%.2f).
                    3. Award marks STRICTLY in discrete increments of 0.5 (e.g. 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, etc.). Never award arbitrary or fractional decimals like 1.87, 1.9, or 1.43.
                    4. In "feedback", clearly explain any mark deductions criterion-by-criterion, highlighting both what was achieved and what was missing or incorrect.
                    5. In "missing_concepts", list specific core criteria, keywords, formulas, or principles from the rubric that were omitted or insufficiently addressed. If all criteria are fully satisfied, return an empty array [].
                    """.formatted(rubric.trim(), maxMarks);
        } else {
            rubricSection = """
                    Grading Guidelines:
                    1. You are an academic examiner evaluating general conceptual correctness, depth, and clarity against the maximum marks (%.2f).
                    2. Award fair partial credit STRICTLY in discrete increments of 0.5 (e.g. 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, etc.). Never award arbitrary or fractional decimals like 1.87, 1.9, or 1.43.
                    3. In "feedback", provide constructive, actionable, and qualitative feedback explaining strengths and deductions.
                    4. In "missing_concepts", list key concepts, theorems, or steps that were omitted or insufficiently explained. If none are missing, return an empty array [].
                    """.formatted(maxMarks);
        }

        String prompt = """
                You are an academic examiner grading a student's descriptive examination answer.

                Question:
                %s

                Student Answer:
                %s

                Maximum Marks: %.2f
                Grading Mode: %s

                %s

                Return ONLY a valid JSON object with the following schema:
                {
                  "score": 0.0,
                  "feedback": "Detailed, constructive feedback on strengths, gaps, and criterion-by-criterion explanation.",
                  "missing_concepts": ["concept/criterion 1", "concept/criterion 2"]
                }
                """.formatted(
                        questionText == null ? "" : questionText,
                        studentAnswer == null ? "" : studentAnswer,
                        maxMarks,
                        mode == null ? "standard" : mode,
                        rubricSection
                );

        try {
            log.info("Gemini grading started: maxMarks={}, mode={}, hasRubric={}", maxMarks, mode, hasRubric);
            String raw = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();
            if (raw == null || raw.isBlank()) {
                throw new IllegalStateException("Gemini returned an empty grading response");
            }
            log.info("Gemini grading returned text ({} chars)", raw.length());

            Map<String, Object> json = parseJson(raw);
            double rawScore = toDouble(json.get("score"), 0.0);
            double score = Math.max(0.0, Math.min(maxMarks, Math.round(rawScore * 2.0) / 2.0));
            String feedback = String.valueOf(json.getOrDefault("feedback", ""));

            List<String> missingConcepts = new ArrayList<>();
            Object rawMissing = json.get("missing_concepts");
            if (rawMissing instanceof List<?> list) {
                list.forEach(value -> missingConcepts.add(String.valueOf(value)));
            }

            return new GradingResult(score, feedback, missingConcepts);
        } catch (Exception exception) {
            log.error("Gemini grading failed: {}", safeMessage(exception));
            return null;
        }
    }

    public List<McqExtraction> extractMcqs(byte[] pdf) {
        String prompt = """
                Extract every multiple-choice question from the attached PDF.
                Return ONLY JSON:
                {
                  "questions": [
                    {
                      "question_text": "...",
                      "options": {"A":"...", "B":"...", "C":"...", "D":"..."},
                      "correct_option": "A",
                      "marks": 1
                    }
                  ]
                }
                """;

        try {
            log.info("Gemini MCQ extraction started: pdfBytes={}", pdf.length);
            String raw = callWithMedia(prompt, pdf, MediaType.APPLICATION_PDF_VALUE);
            if (raw == null || raw.isBlank()) {
                throw new IllegalStateException("Gemini returned an empty MCQ response");
            }
            Map<String, Object> root = parseJson(raw);
            List<McqExtraction> result = new ArrayList<>();

            Object rawQuestions = root.get("questions");
            if (rawQuestions instanceof List<?> questions) {
                for (Object rawItem : questions) {
                    if (!(rawItem instanceof Map<?, ?> item)) {
                        continue;
                    }

                    Map<String, String> options = new HashMap<>();
                    Object rawOptions = item.get("options");
                    if (rawOptions instanceof Map<?, ?> optionMap) {
                        optionMap.forEach((key, value) -> options.put(String.valueOf(key), String.valueOf(value)));
                    }

                    result.add(new McqExtraction(
                            String.valueOf(item.containsKey("question_text") ? item.get("question_text") : ""),
                            options,
                            String.valueOf(item.containsKey("correct_option") ? item.get("correct_option") : ""),
                            toDouble(item.get("marks"), 1.0)
                    ));
                }
            }

            return result;
        } catch (Exception exception) {
            log.error("Gemini MCQ extraction failed: {}", safeMessage(exception));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Gemini MCQ extraction failed. Check backend logs and GEMINI_MODEL configuration.", exception);
        }
    }

    private String safeMessage(Throwable exception) {
        // Walk the cause chain: Spring AI / the Google GenAI SDK wrap the real error
        // (404 model not found, 400 bad key, 429 quota...) under "Failed to generate content".
        StringBuilder chain = new StringBuilder();
        Throwable current = exception;
        int depth = 0;
        while (current != null && depth++ < 8) {
            String message = current.getMessage();
            if (chain.length() > 0) chain.append(" <- caused by ");
            chain.append(current.getClass().getSimpleName()).append(": ")
                    .append(message == null || message.isBlank() ? "(no message)" : message);
            current = current.getCause() == current ? null : current.getCause();
        }
        // Avoid printing likely API-key query parameters if present in a client exception.
        return chain.toString().replaceAll("(?i)(key=)[^&\\s]+", "$1[REDACTED]");
    }

    private String callWithMedia(String prompt, byte[] data, String contentType) {
        return callWithMedia(prompt, List.of(new MediaInput(data, contentType)));
    }

    private String callWithMedia(String prompt, List<MediaInput> documents) {
        List<Media> media = documents.stream()
                .map(document -> new Media(
                        MimeTypeUtils.parseMimeType(document.contentType()),
                        new ByteArrayResource(document.data())
                ))
                .toList();

        UserMessage message = UserMessage.builder()
                .text(prompt)
                .media(media)
                .build();

        return chatClient.prompt(new Prompt(message))
                .call()
                .content();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String raw) throws IOException {
        String cleaned = raw == null ? "" : raw.trim();
        if (cleaned.startsWith("```")) {
            int firstNewline = cleaned.indexOf('\n');
            if (firstNewline >= 0) {
                cleaned = cleaned.substring(firstNewline + 1);
            }
            if (cleaned.endsWith("```")) {
                cleaned = cleaned.substring(0, cleaned.length() - 3).trim();
            }
        }

        return objectMapper.readValue(cleaned, new TypeReference<Map<String, Object>>() {});
    }

    private double toDouble(Object value, double fallback) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (Exception exception) {
            return fallback;
        }
    }

    public record MediaInput(byte[] data, String contentType) {
    }

    public record QuestionContext(String id, int number, String text) {
    }

    public record GradingResult(double score, String feedback, List<String> missingConcepts) {
    }

    public record McqExtraction(
            String questionText,
            Map<String, String> options,
            String correctOption,
            double marks
    ) {
    }
}