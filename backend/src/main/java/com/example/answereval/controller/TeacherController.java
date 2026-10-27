package com.example.answereval.controller;

import com.example.answereval.dto.AuthDtos;
import com.example.answereval.entity.User;
import com.example.answereval.entity.UserRole;
import com.example.answereval.repository.UserRepository;
import com.example.answereval.security.UserPrincipal;
import com.example.answereval.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.security.SecureRandom;
import java.util.*;

@RestController
@RequestMapping("/api/teacher")
@PreAuthorize("hasRole('TEACHER')")
public class TeacherController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AuthService authService;

    public TeacherController(UserRepository users, PasswordEncoder encoder, AuthService authService) {
        this.users = users;
        this.encoder = encoder;
        this.authService = authService;
    }

    @GetMapping("/students")
    public List<AuthDtos.UserResponse> students() {
        return users.findByRoleOrderByFullNameAsc(UserRole.STUDENT).stream().map(authService::toResponse).toList();
    }

    @PostMapping("/students")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createStudent(
            @Valid @RequestBody CreateStudentRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        String temporaryPassword = request.temporaryPassword() == null || request.temporaryPassword().isBlank()
                ? generatePassword()
                : request.temporaryPassword();
        User student = new User();
        student.setEmail(email);
        student.setFullName(request.fullName().trim());
        student.setUsn(request.usn());
        student.setSemester(request.semester());
        student.setBranch(request.branch());
        student.setSection(request.section());
        student.setRole(UserRole.STUDENT);
        student.setPasswordHash(encoder.encode(temporaryPassword));
        User saved = users.save(student);
        return Map.of(
                "student", authService.toResponse(saved),
                "temporaryPassword", temporaryPassword,
                "temporary_password", temporaryPassword,
                "message", "Student account created. Share the temporary password securely."
        );
    }

    @PutMapping("/students/{id}")
    public AuthDtos.UserResponse updateStudent(
            @PathVariable UUID id,
            @RequestBody UpdateStudentRequest request
    ) {
        User student = users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found"));
        if (student.getRole() != UserRole.STUDENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a student");
        }
        if (request.fullName() != null && !request.fullName().isBlank()) {
            student.setFullName(request.fullName().trim());
        }
        if (request.usn() != null) {
            student.setUsn(request.usn().trim());
        }
        if (request.semester() != null) {
            student.setSemester(request.semester());
        }
        if (request.branch() != null && !request.branch().isBlank()) {
            student.setBranch(request.branch().trim());
        }
        if (request.section() != null && !request.section().isBlank()) {
            student.setSection(request.section().trim());
        }
        if (request.temporaryPassword() != null && !request.temporaryPassword().isBlank()) {
            student.setPasswordHash(encoder.encode(request.temporaryPassword()));
        }
        return authService.toResponse(users.save(student));
    }

    @DeleteMapping("/students/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStudent(@PathVariable UUID id) {
        User student = users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found"));
        users.delete(student);
    }

    private String generatePassword() {
        byte[] bytes = new byte[9];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record CreateStudentRequest(
            @jakarta.validation.constraints.Email @jakarta.validation.constraints.NotBlank String email,
            @jakarta.validation.constraints.NotBlank
            @com.fasterxml.jackson.annotation.JsonAlias({"full_name", "fullName"})
            String fullName,
            String usn,
            @jakarta.validation.constraints.NotNull Integer semester,
            @jakarta.validation.constraints.NotBlank String branch,
            @jakarta.validation.constraints.NotBlank String section,
            @com.fasterxml.jackson.annotation.JsonAlias({"temporary_password", "temporaryPassword"})
            String temporaryPassword
    ) { }

    public record UpdateStudentRequest(
            @com.fasterxml.jackson.annotation.JsonAlias({"full_name", "fullName"})
            String fullName,
            String usn,
            Integer semester,
            String branch,
            String section,
            @com.fasterxml.jackson.annotation.JsonAlias({"temporary_password", "temporaryPassword"})
            String temporaryPassword
    ) { }
}
