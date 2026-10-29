package com.example.answereval.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EvaluationRoundingTest {

    @Test
    void testDiscreteHalfPointRounding() {
        // Clamping to 0.0 and maxMarks
        assertEquals(0.0, EvaluationService.roundToHalf(-0.5, 4.0));
        assertEquals(4.0, EvaluationService.roundToHalf(4.8, 4.0));

        // Exact half increments
        assertEquals(0.0, EvaluationService.roundToHalf(0.0, 4.0));
        assertEquals(0.5, EvaluationService.roundToHalf(0.5, 4.0));
        assertEquals(1.0, EvaluationService.roundToHalf(1.0, 4.0));
        assertEquals(1.5, EvaluationService.roundToHalf(1.5, 4.0));
        assertEquals(2.0, EvaluationService.roundToHalf(2.0, 4.0));

        // Decimals rounding to closest half
        assertEquals(0.0, EvaluationService.roundToHalf(0.18, 4.0));
        assertEquals(0.5, EvaluationService.roundToHalf(0.26, 4.0));
        assertEquals(0.5, EvaluationService.roundToHalf(0.68, 4.0));
        assertEquals(1.0, EvaluationService.roundToHalf(0.85, 4.0));
        assertEquals(1.0, EvaluationService.roundToHalf(1.24, 4.0));
        assertEquals(1.5, EvaluationService.roundToHalf(1.43, 4.0));
        assertEquals(2.0, EvaluationService.roundToHalf(1.87, 4.0));
        assertEquals(2.0, EvaluationService.roundToHalf(1.96, 4.0));
        assertEquals(3.5, EvaluationService.roundToHalf(3.3, 4.0));
        assertEquals(3.5, EvaluationService.roundToHalf(3.6, 4.0));
        assertEquals(4.0, EvaluationService.roundToHalf(3.8, 4.0));
    }
}
