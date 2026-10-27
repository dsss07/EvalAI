package com.example.answereval.service;

import com.example.answereval.config.FileStorageConfig;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Service
public class FileStorageService {

    private final FileStorageConfig config;

    public FileStorageService(FileStorageConfig config) {
        this.config = config;
    }

    public StoredFile store(MultipartFile file) throws IOException {
        Files.createDirectories(config.getUploadDirectory());
        String original = StringUtils.cleanPath(file.getOriginalFilename() == null ? "upload" : file.getOriginalFilename());
        String extension = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) {
            extension = original.substring(dot).toLowerCase();
        }

        String filename = UUID.randomUUID() + extension;
        Path target = config.getUploadDirectory().resolve(filename).normalize();
        if (!target.startsWith(config.getUploadDirectory())) {
            throw new IOException("Invalid file path");
        }

        Files.copy(file.getInputStream(), target);
        return new StoredFile(filename, target, file.getContentType() == null ? "application/octet-stream" : file.getContentType());
    }

    public Path resolve(String filename) {
        String clean = StringUtils.cleanPath(filename);
        Path target = config.getUploadDirectory().resolve(clean).normalize();
        if (!target.startsWith(config.getUploadDirectory())) {
            throw new IllegalArgumentException("Invalid file path: " + filename);
        }
        return target;
    }

    public byte[] loadBytes(String filename) throws IOException {
        Path target = resolve(filename);
        return Files.readAllBytes(target);
    }

    public String detectContentType(String filename) {
        Path target = resolve(filename);
        try {
            String probe = Files.probeContentType(target);
            if (probe != null) {
                return probe;
            }
        } catch (IOException ignored) {
        }
        String lower = filename.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".pdf")) return "application/pdf";
        return "application/octet-stream";
    }

    public record StoredFile(String filename, Path path, String contentType) {
    }
}
