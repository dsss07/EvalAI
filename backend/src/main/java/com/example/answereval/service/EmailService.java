package com.example.answereval.service;

import com.example.answereval.dto.QuestionScoreItem;
import com.example.answereval.entity.QuestionSet;
import com.example.answereval.entity.User;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${spring.mail.host:localhost}")
    private String mailHost;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    @Async
    public void sendResultsPublishedEmail(
            User student,
            QuestionSet set,
            double totalScore,
            double maxScore,
            List<QuestionScoreItem> questionBreakdown
    ) {
        if (student == null || student.getEmail() == null || student.getEmail().isBlank()) {
            log.warn("Cannot send results email: student or email is missing");
            return;
        }

        String studentName = student.getFullName() != null ? student.getFullName() : "Student";
        String subject = "[EvalAI] Examination Results Published: " + set.getTitle();
        double percentage = maxScore > 0 ? (totalScore / maxScore) * 100.0 : 0.0;

        // Safe mock / fallback mode when mail credentials are not configured or host is default localhost
        boolean isMockMode = mailUsername == null || mailUsername.isBlank() || "localhost".equalsIgnoreCase(mailHost);

        if (isMockMode) {
            log.info("[MOCK EMAIL] Result notification ready for {} <{}>. Exam: '{}' (Subject: {}). Score: {}/{} ({}%). Question Count: {}. Portal Link: {}/my-results",
                    studentName, student.getEmail(), set.getTitle(), set.getSubject(), totalScore, maxScore, Math.round(percentage),
                    questionBreakdown != null ? questionBreakdown.size() : 0, frontendUrl);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.info("[MOCK EMAIL - No JavaMailSender bean] To: {} <{}>, Exam: '{}', Score: {}/{}",
                    studentName, student.getEmail(), set.getTitle(), totalScore, maxScore);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(student.getEmail());
            helper.setFrom(mailUsername);
            helper.setSubject(subject);

            String html = buildResultsHtml(studentName, set, totalScore, maxScore, percentage, questionBreakdown);
            helper.setText(html, true);

            mailSender.send(message);
            log.info("Sent results published email to {} <{}> for exam '{}'", studentName, student.getEmail(), set.getTitle());
        } catch (Exception e) {
            log.warn("Failed to deliver results email to {}: {}. Fallback to mock log.", student.getEmail(), e.getMessage());
        }
    }

    private String buildResultsHtml(
            String studentName,
            QuestionSet set,
            double totalScore,
            double maxScore,
            double percentage,
            List<QuestionScoreItem> questionBreakdown
    ) {
        StringBuilder tableRows = new StringBuilder();
        if (questionBreakdown != null && !questionBreakdown.isEmpty()) {
            for (QuestionScoreItem item : questionBreakdown) {
                String qText = item.questionText() != null ? item.questionText() : "";
                if (qText.length() > 60) {
                    qText = qText.substring(0, 57) + "...";
                }
                tableRows.append("<tr>")
                        .append("<td style=\"padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #1E293B;\">Q").append(item.questionNumber()).append("</td>")
                        .append("<td style=\"padding: 10px 14px; border-bottom: 1px solid #E2E8F0; color: #475569;\">").append(escapeHtml(qText)).append("</td>")
                        .append("<td style=\"padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 600; color: #2563EB;\">").append(formatScore(item.scoreAwarded())).append("</td>")
                        .append("<td style=\"padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; color: #64748B;\">").append(formatScore(item.maxMarks())).append("</td>")
                        .append("</tr>");
            }
        } else {
            tableRows.append("<tr><td colspan=\"4\" style=\"padding: 14px; text-align: center; color: #94A3B8;\">Detailed question scores available on the portal.</td></tr>");
        }

        String scoreColor = percentage >= 75.0 ? "#059669" : (percentage >= 40.0 ? "#2563EB" : "#DC2626");
        String myResultsUrl = frontendUrl + "/my-results";

        return "<!DOCTYPE html>"
                + "<html>"
                + "<head><meta charset=\"UTF-8\"></head>"
                + "<body style=\"margin: 0; padding: 24px; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\">"
                + "  <div style=\"max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);\">"
                + "    <div style=\"background: linear-gradient(135deg, #1E40AF, #2563EB); padding: 28px 32px; color: #FFFFFF;\">"
                + "      <p style=\"margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #BFDBFE;\">EvalAI • Academic Evaluation Portal</p>"
                + "      <h1 style=\"margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;\">Examination Results Published</h1>"
                + "    </div>"
                + "    <div style=\"padding: 32px;\">"
                + "      <p style=\"font-size: 15px; color: #334155; margin-top: 0; line-height: 1.5;\">Hello <strong>" + escapeHtml(studentName) + "</strong>,</p>"
                + "      <p style=\"font-size: 14px; color: #475569; line-height: 1.6;\">Your answer script evaluation for <strong>" + escapeHtml(set.getTitle()) + "</strong> (" + escapeHtml(set.getSubject() != null ? set.getSubject() : "General") + ") has been finalized and published by your faculty instructor.</p>"
                + "      <div style=\"background: #F1F5F9; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #E2E8F0; text-align: center;\">"
                + "        <span style=\"display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748B; margin-bottom: 4px;\">Final Awarded Score</span>"
                + "        <div style=\"font-size: 32px; font-weight: 800; color: " + scoreColor + ";\">" + formatScore(totalScore) + " <span style=\"font-size: 18px; color: #64748B; font-weight: 500;\">/ " + formatScore(maxScore) + "</span></div>"
                + "        <span style=\"display: inline-block; margin-top: 6px; padding: 3px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: #FFFFFF; color: " + scoreColor + "; border: 1px solid #CBD5E1;\">" + Math.round(percentage) + "% Total Performance</span>"
                + "      </div>"
                + "      <h3 style=\"font-size: 14px; font-weight: 700; color: #1E293B; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;\">Question-by-Question Breakdown</h3>"
                + "      <table style=\"width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 28px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;\">"
                + "        <thead>"
                + "          <tr style=\"background: #F8FAFC; color: #64748B; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;\">"
                + "            <th style=\"padding: 10px 14px; text-align: left; border-bottom: 1px solid #E2E8F0;\">Q#</th>"
                + "            <th style=\"padding: 10px 14px; text-align: left; border-bottom: 1px solid #E2E8F0;\">Question</th>"
                + "            <th style=\"padding: 10px 14px; text-align: right; border-bottom: 1px solid #E2E8F0;\">Marks</th>"
                + "            <th style=\"padding: 10px 14px; text-align: right; border-bottom: 1px solid #E2E8F0;\">Max</th>"
                + "          </tr>"
                + "        </thead>"
                + "        <tbody>"
                + tableRows.toString()
                + "        </tbody>"
                + "      </table>"
                + "      <div style=\"text-align: center; margin: 32px 0 16px;\">"
                + "        <a href=\"" + myResultsUrl + "\" style=\"display: inline-block; background-color: #2563EB; color: #FFFFFF; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);\">View Full Graded Script & AI Feedback ➔</a>"
                + "      </div>"
                + "      <p style=\"font-size: 12px; color: #64748B; text-align: center; line-height: 1.5; margin-top: 20px;\">If you identify an OCR recognition discrepancy or have grading questions, you can submit a review request via the <strong>Report Discrepancy</strong> button in your results portal.</p>"
                + "    </div>"
                + "    <div style=\"background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 16px 32px; text-align: center; font-size: 11px; color: #94A3B8;\">"
                + "      EvalAI Automated Notification System • Do not reply directly to this email"
                + "    </div>"
                + "  </div>"
                + "</body>"
                + "</html>";
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String formatScore(double score) {
        if (score == (long) score) {
            return String.format("%d", (long) score);
        } else {
            return String.format("%.1f", score);
        }
    }
}
