from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel, Field
import logging

logger = logging.getLogger(__name__)

try:
    import spacy
    from sentence_transformers import SentenceTransformer, util as st_util
except ImportError:
    spacy = None
    SentenceTransformer = None
    st_util = None

try:
    import cv2
    import numpy as np
    import pytesseract
except ImportError:
    cv2 = None
    np = None
    pytesseract = None

app = FastAPI(title="Answer Evaluator Python Processing Service", version="1.1.0")

_similarity_model = None
_nlp = None

MODE_CONFIG = {
    "easy": {"keyword_weight": 0.30, "similarity_weight": 0.70, "keyword_min_ratio": 0.0},
    "mid": {"keyword_weight": 0.50, "similarity_weight": 0.50, "keyword_min_ratio": 0.0},
    "hard": {"keyword_weight": 0.60, "similarity_weight": 0.40, "keyword_min_ratio": 0.80},
}


class LocalGradeRequest(BaseModel):
    student_answer: str = ""
    answer_key: str = ""
    max_marks: float = Field(ge=0)
    mode: str = "mid"


class LocalGradeResponse(BaseModel):
    score: float
    max_score: float
    similarity_score: float
    keywords: list[str]
    keywords_matched: list[str]
    keywords_missed: list[str]
    keyword_ratio: float
    mode: str
    grading_method: str = "local"


def load_grading_models():
    global _similarity_model, _nlp
    if SentenceTransformer is None or spacy is None:
        logger.warning("Local semantic grading dependencies are unavailable")
        return
    if _similarity_model is None:
        _similarity_model = SentenceTransformer("all-MiniLM-L6-v2")
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")


class OCRResponse(BaseModel):
    text: str
    confidence: float


@app.on_event("startup")
def startup():
    try:
        load_grading_models()
    except Exception as exc:
        logger.exception("Unable to load local grading models: %s", exc)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "ocr_available": pytesseract is not None,
        "local_grading_available": _similarity_model is not None and _nlp is not None,
    }


def _extract_keywords(answer_key: str) -> list[str]:
    doc = _nlp(answer_key)
    seen = set()
    keywords = []
    for chunk in doc.noun_chunks:
        lemma = chunk.root.lemma_.lower()
        if lemma not in seen and len(lemma) > 2:
            seen.add(lemma)
            keywords.append(chunk.text.lower())
    for ent in doc.ents:
        lemma = ent.text.lower()
        if lemma not in seen:
            seen.add(lemma)
            keywords.append(lemma)
    return keywords


def _check_keywords(student_answer: str, keywords: list[str]):
    if not keywords:
        return [], [], 1.0
    student_doc = _nlp(student_answer.lower())
    student_lemmas = {token.lemma_.lower() for token in student_doc}
    student_lower = student_answer.lower()
    matched, missed = [], []
    for keyword in keywords:
        keyword_doc = _nlp(keyword)
        keyword_lemma = keyword_doc[0].lemma_.lower() if len(keyword_doc) == 1 else keyword.lower()
        (matched if keyword_lemma in student_lemmas or keyword.lower() in student_lower else missed).append(keyword)
    return matched, missed, len(matched) / len(keywords)


@app.post("/grade/local", response_model=LocalGradeResponse)
def grade_local(request: LocalGradeRequest):
    if _similarity_model is None or _nlp is None or st_util is None:
        raise HTTPException(status_code=503, detail="Local grading models are unavailable")
    student_answer = request.student_answer or ""
    answer_key = request.answer_key or ""
    max_marks = request.max_marks
    mode = request.mode.lower() if request.mode.lower() in MODE_CONFIG else "mid"
    if not student_answer.strip() or not answer_key.strip() or max_marks <= 0:
        return LocalGradeResponse(
            score=0.0, max_score=max_marks, similarity_score=0.0,
            keywords=[], keywords_matched=[], keywords_missed=[], keyword_ratio=0.0, mode=mode,
        )

    embeddings = _similarity_model.encode([student_answer, answer_key], convert_to_tensor=True)
    similarity = max(0.0, min(1.0, float(st_util.cos_sim(embeddings[0], embeddings[1]).item())))
    keywords = _extract_keywords(answer_key)
    matched, missed, ratio = _check_keywords(student_answer, keywords)
    cfg = MODE_CONFIG[mode]
    keyword_score = ratio * (0.5 if mode == "hard" and ratio < cfg["keyword_min_ratio"] else 1.0)
    raw_score = cfg["similarity_weight"] * similarity + cfg["keyword_weight"] * keyword_score
    score = round(round(max(0.0, min(max_marks, raw_score * max_marks)) * 2) / 2, 1)
    return LocalGradeResponse(
        score=score, max_score=max_marks, similarity_score=round(similarity, 4),
        keywords=keywords, keywords_matched=matched, keywords_missed=missed,
        keyword_ratio=round(ratio, 4), mode=mode,
    )


@app.post("/ocr", response_model=OCRResponse)
async def ocr(file: UploadFile = File(...)):
    if cv2 is None or np is None or pytesseract is None:
        raise HTTPException(status_code=503, detail="Python OCR dependencies are not installed")

    data = await file.read()
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    thresholded = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )

    data = pytesseract.image_to_data(
        thresholded,
        output_type=pytesseract.Output.DICT,
        config="--psm 6",
    )

    words = []
    confidences = []
    for index, word in enumerate(data["text"]):
        word = word.strip()
        if not word:
            continue
        words.append(word)
        try:
            confidence = float(data["conf"][index])
            if confidence >= 0:
                confidences.append(confidence)
        except (TypeError, ValueError):
            pass

    text = " ".join(words)
    confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return OCRResponse(text=text, confidence=confidence)
