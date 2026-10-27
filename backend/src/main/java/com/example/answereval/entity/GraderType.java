package com.example.answereval.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum GraderType {
    AI("ai"),
    TEACHER("teacher");

    private final String value;

    GraderType(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static GraderType fromValue(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
