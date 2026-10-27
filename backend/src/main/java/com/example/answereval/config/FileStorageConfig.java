package com.example.answereval.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;

@Configuration
public class FileStorageConfig {

    private final Path uploadDirectory;

    public FileStorageConfig(@Value("${app.uploads.directory}") String directory) {
        this.uploadDirectory = Path.of(directory).toAbsolutePath().normalize();
    }

    public Path getUploadDirectory() {
        return uploadDirectory;
    }
}
