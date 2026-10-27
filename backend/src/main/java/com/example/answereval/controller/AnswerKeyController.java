package com.example.answereval.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;

@RestController
@RequestMapping("/api/answer-key")
@PreAuthorize("hasRole('TEACHER')")
public class AnswerKeyController {
    private final RestClient restClient;
    private final String pythonServiceUrl;
    public AnswerKeyController(RestClient.Builder builder,
            @Value("${app.python-service.base-url:http://localhost:8001}") String pythonServiceUrl) {
        this.restClient = builder.build(); this.pythonServiceUrl = pythonServiceUrl;
    }
    @PostMapping(value="/extract", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> extract(@RequestPart("file") MultipartFile file) throws IOException {
        if (file.isEmpty() || file.getOriginalFilename() == null || !file.getOriginalFilename().toLowerCase().endsWith(".docx")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload a non-empty .docx Word document");
        }
        ByteArrayResource resource = new ByteArrayResource(file.getBytes()) {
            @Override public String getFilename() { return file.getOriginalFilename(); }
        };
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>(); body.add("file", resource);
        try {
            String response = restClient.post().uri(pythonServiceUrl + "/answer-key/extract")
                    .contentType(MediaType.MULTIPART_FORM_DATA).body(body).retrieve().body(String.class);
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(response);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not reach Python answer-key service. Start it on the configured URL and try again.");
        }
    }
}
