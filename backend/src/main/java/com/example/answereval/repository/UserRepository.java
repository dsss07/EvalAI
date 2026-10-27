package com.example.answereval.repository;

import com.example.answereval.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
import java.util.List;
import com.example.answereval.entity.UserRole;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmailIgnoreCase(String email);
    List<User> findByRoleOrderByFullNameAsc(UserRole role);
}
