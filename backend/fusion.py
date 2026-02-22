from dataclasses import dataclass
from typing import List, Optional, Dict, Any

@dataclass(frozen=True)
class FusionResult:
    risk_score: float
    components: Dict[str, float]
    reasons: List[str]
    recommended_action: str

def calculate_risk(
    ml_confidence: float,
    is_invasive: bool,
    species: str,
    report_density: float = 0.0,
    satellite_score: float = 0.0,  # 0..1, where 1 is high anomaly/change
    reputation: float = 0.5,
    photo_quality: float = 0.5,
    seasonality: float = 0.5,
) -> FusionResult:
    
    # Weights
    W_ML = 0.40
    W_DENSITY = 0.25
    W_SAT = 0.25
    W_REP = 0.05
    W_QUAL = 0.03
    W_SEAS = 0.02

    # Base Calculation
    risk = (
        (ml_confidence * W_ML) +
        (report_density * W_DENSITY) +
        (satellite_score * W_SAT) +
        (reputation * W_REP) +
        (photo_quality * W_QUAL) +
        (seasonality * W_SEAS)
    )

    components = {
        "ml": ml_confidence * W_ML,
        "density": report_density * W_DENSITY,
        "satellite": satellite_score * W_SAT,
        "reputation": reputation * W_REP,
        "quality": photo_quality * W_QUAL,
        "seasonality": seasonality * W_SEAS
    }

    reasons = []

    # Calibration Rules
    
    # 1. Non-invasive / Unknown
    if not is_invasive or species.lower() in ["unknown", "native", "unknown organism"]:
        if risk > 0.30:
            risk = 0.30
            reasons.append("Capped risk: Species identified as non-invasive or unknown.")
    
    # 2. Low confidence ML + No strong corroboration
    elif ml_confidence < 0.60 and satellite_score < 0.4 and report_density < 0.3:
        if risk > 0.55:
            risk = 0.55
            reasons.append("Capped risk: Low ML confidence without strong satellite or density corroboration.")

    # 3. High confidence ML + Satellite Anomaly
    elif ml_confidence > 0.85 and satellite_score > 0.7:
        risk = min(0.99, risk + 0.05)
        reasons.append("Boosted risk: High ML confidence corroborated by satellite anomaly.")

    # 4. Density Boost
    if report_density > 0.8:
        reasons.append("High report density in area suggests active outbreak.")

    # Ensure bounds
    risk = max(0.0, min(1.0, risk))

    # Recommended Action
    if risk >= 0.80:
        action = "Immediate Verification & Containment Alert"
    elif risk >= 0.60:
        action = "Priority Review & Satellite Monitoring"
    elif risk >= 0.40:
        action = "Routine Review"
    else:
        action = "Log & Passive Monitor"

    return FusionResult(
        risk_score=risk,
        components=components,
        reasons=reasons,
        recommended_action=action
    )
