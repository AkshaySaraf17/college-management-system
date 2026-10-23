"""
Student performance analytics service.

Two things happen here, both computed from the student's real records (no canned data):

1. An explainable risk score (0-100): a weighted sum of attendance, marks, trend, assignment
   completion, backlogs and overdue fees. Every point of the score is attributed to a named factor.
2. A least-squares forecast of the student's next exam percentage from their exam history.

This is a transparent heuristic model, not a trained ML model: with a single college's data there
is no labelled history to train on, so weights are fixed and documented below.

Calibration: attendance risk reaches its maximum at 30% (85% or more scores zero); marks risk reaches its
maximum at an average of 20% (70% or more scores zero). Scores of 60+ are HIGH, 35-59 MEDIUM.
"""

from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="College Management System - Performance Analytics")

WEIGHTS = {
    "attendance": 30.0,
    "marks": 30.0,
    "trend": 10.0,
    "assignments": 10.0,
    "backlogs": 12.0,
    "fees": 8.0,
}


class StudentFeatures(BaseModel):
    attendance_pct: Optional[float] = Field(None, ge=0, le=100)
    avg_marks_pct: Optional[float] = Field(None, ge=0, le=100)
    score_history: List[float] = Field(default_factory=list, description="Chronological exam percentages")
    assignment_rate: Optional[float] = Field(None, ge=0, le=100)
    overdue_fee_amount: float = 0
    backlogs: int = 0
    cgpa: Optional[float] = None


class BatchItem(BaseModel):
    id: str
    features: StudentFeatures


class BatchRequest(BaseModel):
    students: List[BatchItem]


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def linear_trend(history: List[float]):
    """Least-squares slope and next-point prediction; None when there is too little data."""
    n = len(history)
    if n < 2:
        return None, None
    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(history) / n
    denom = sum((x - mean_x) ** 2 for x in xs)
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, history)) / denom
    intercept = mean_y - slope * mean_x
    predicted = clamp(intercept + slope * n, 0, 100)
    return slope, predicted


def analyze(f: StudentFeatures) -> dict:
    factors = []
    signals = 0

    def add(name: str, points: float, detail: str):
        factors.append({"factor": name, "points": round(points, 1), "detail": detail})

    if f.attendance_pct is not None:
        signals += 1
        pts = clamp((85 - f.attendance_pct) / 55) * WEIGHTS["attendance"]
        add("Attendance", pts, f"{f.attendance_pct:.1f}% attendance (healthy is 85%+, minimum 75%)")
    if f.avg_marks_pct is not None:
        signals += 1
        pts = clamp((70 - f.avg_marks_pct) / 50) * WEIGHTS["marks"]
        add("Marks", pts, f"{f.avg_marks_pct:.1f}% average across published exams")

    slope, predicted = linear_trend(f.score_history)
    if slope is not None:
        signals += 1
        pts = clamp(-slope / 20) * WEIGHTS["trend"] if slope < 0 else 0.0
        direction = "declining" if slope < 0 else "improving or steady"
        add("Score trend", pts, f"Scores are {direction} ({slope:+.1f} points per exam)")
    if f.assignment_rate is not None:
        signals += 1
        pts = clamp((80 - f.assignment_rate) / 80) * WEIGHTS["assignments"]
        add("Assignments", pts, f"{f.assignment_rate:.0f}% of due assignments submitted")
    if f.backlogs > 0:
        pts = min(f.backlogs, 3) / 3 * WEIGHTS["backlogs"]
        add("Backlogs", pts, f"{f.backlogs} failed or missed paper(s)")
    if f.overdue_fee_amount > 0:
        add("Fees", WEIGHTS["fees"], f"{f.overdue_fee_amount:.0f} overdue (a common early dropout signal)")

    score = round(min(100.0, sum(x["points"] for x in factors)), 1)
    level = "HIGH" if score >= 60 else "MEDIUM" if score >= 35 else "LOW"
    confidence = "HIGH" if signals >= 4 else "MEDIUM" if signals >= 2 else "LOW"

    recommendations = []
    by_name = {x["factor"]: x["points"] for x in factors}
    if by_name.get("Attendance", 0) >= 8:
        recommendations.append("Meet the student about attendance; below 75% risks exam eligibility.")
    if by_name.get("Marks", 0) >= 10:
        recommendations.append("Arrange remedial sessions or peer tutoring in the weakest subjects.")
    if by_name.get("Score trend", 0) >= 3:
        recommendations.append("Scores are falling exam over exam; review recent topics before the next assessment.")
    if by_name.get("Assignments", 0) >= 4:
        recommendations.append("Follow up on missing assignments; consistent submissions strongly predict outcomes.")
    if by_name.get("Backlogs", 0) > 0:
        recommendations.append("Plan backlog clearance papers and map them to upcoming exam windows.")
    if by_name.get("Fees", 0) > 0:
        recommendations.append("Refer to the accounts office for fee counselling or scholarship options.")
    if not recommendations:
        recommendations.append("No concerns detected. Keep monitoring through the semester.")

    return {
        "risk_score": score,
        "risk_level": level,
        "confidence": confidence,
        "predicted_next_score": round(predicted, 1) if predicted is not None else None,
        "trend_per_exam": round(slope, 2) if slope is not None else None,
        "factors": factors,
        "recommendations": recommendations,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze/student")
def analyze_student(features: StudentFeatures):
    return analyze(features)


@app.post("/analyze/batch")
def analyze_batch(req: BatchRequest):
    return {"results": [{"id": s.id, **analyze(s.features)} for s in req.students]}
