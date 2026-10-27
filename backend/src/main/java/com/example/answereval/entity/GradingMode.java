package com.example.answereval.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum GradingMode {
    EASY("easy"),
    MID("mid"),
    HARD("hard");

    private final String value;

    GradingMode(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static GradingMode fromValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
