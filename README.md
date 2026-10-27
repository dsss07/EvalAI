EvalAI — Automated Handwritten Answer Script Evaluation

EvalAI is an assessment platform where students upload photos or PDFs of their handwritten answer sheets, and an AI pipeline automatically transcribes the handwriting, maps answers to questions, and grades them using both semantic similarity and custom marking schemes.

Tech Stack:
Backend: Java 21, Spring Boot 3, Spring Data JPA, Hibernate

Message Broker: RabbitMQ (Dual workers, direct exchange, dead-letter queue)

Real-Time: WebSockets with STOMP & SockJS

Database: PostgreSQL 16

NLP & AI:

Python FastAPI (SentenceTransformers all-MiniLM-L6-v2, spaCy)

Google Gemini Vision VLM & Gemini LLM

Frontend: React 18, Vite, TypeScript, Tailwind CSS

Security & Auth: Spring Security with Stateless JWT