from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.pyq import stats as pyq_stats
from app.db import get_db
from app.models import Attempt, AttemptStatus, User
from app.security import current_user

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    attempts = db.scalars(
        select(Attempt)
        .where(Attempt.user_id == user.id, Attempt.status == AttemptStatus.submitted)
        .order_by(Attempt.submitted_at)
    ).all()

    trend, sections = [], defaultdict(lambda: {"correct": 0, "incorrect": 0, "unattempted": 0, "time_seconds": 0})
    total_time = correct = incorrect = 0
    best = None
    for a in attempts:
        s = a.summary or {}
        pct = round(100 * (a.score or 0) / a.max_score, 1) if a.max_score else 0.0
        trend.append({
            "attempt_id": a.id,
            "test_title": a.test.title,
            "date": a.submitted_at.isoformat() if a.submitted_at else None,
            "score": a.score,
            "max_score": a.max_score,
            "percent": pct,
            "accuracy": s.get("accuracy", 0.0),
        })
        best = pct if best is None else max(best, pct)
        correct += s.get("correct", 0)
        incorrect += s.get("incorrect", 0)
        total_time += s.get("time_seconds", 0)
        for sec in s.get("sections", []):
            agg = sections[sec["name"]]
            for k in agg:
                agg[k] += sec.get(k, 0)

    section_rows = [
        {"name": name, **v, "accuracy": round(100 * v["correct"] / (v["correct"] + v["incorrect"]), 1)
         if v["correct"] + v["incorrect"] else 0.0}
        for name, v in sections.items()
    ]
    section_rows.sort(key=lambda r: r["accuracy"])
    return {
        "user": {"name": user.name},
        "totals": {
            "tests_taken": len(attempts),
            "avg_percent": round(sum(t["percent"] for t in trend) / len(trend), 1) if trend else 0.0,
            "best_percent": best or 0.0,
            "accuracy": round(100 * correct / (correct + incorrect), 1) if correct + incorrect else 0.0,
            "hours_practiced": round(total_time / 3600, 1),
        },
        "trend": trend[-20:],
        "sections": section_rows,
        # Weakest attempted sections below 60% accuracy.
        "weak_areas": [r["name"] for r in section_rows if r["correct"] + r["incorrect"] > 0 and r["accuracy"] < 60][:3],
        "recent": list(reversed(trend[-5:])),
        "pyq": pyq_stats(exam_id=None, db=db, user=user),
    }
