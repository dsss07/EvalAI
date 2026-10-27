package com.example.answereval;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class AnswerEvaluatorApplication {

    public static void main(String[] args) {
        SpringApplication.run(AnswerEvaluatorApplication.class, args);
    }
}
