import os
import smtplib
from email.mime.text import MIMEText
from typing import List, Optional

PLAYBOOKS = {
    "plant": """
    Standard Protocol for Invasive Plant Outbreak:
    1. Verify species ID via expert review or DNA if needed.
    2. Map the extent of the infestation (use satellite NDVI + ground survey).
    3. Assess density: Is it a single patch or widespread?
    4. Containment:
       - Mechanical removal (hand-pulling, mowing) for small patches.
       - Chemical treatment (herbicide) for large monocultures, if permitted.
    5. Disposal: Do not compost invasive seeds. Bag and landfill or burn.
    6. Monitor site for 3-5 years for regrowth.
    """,
    "insect": """
    Standard Protocol for Invasive Insect Outbreak:
    1. Quarantine the affected area immediately. restrict movement of wood/soil.
    2. Deploy pheromone traps to determine spread radius.
    3. Biological control: Introduce approved predators/parasitoids if available.
    4. Chemical control: Systemic insecticides for high-value trees/crops.
    5. Remove and chip/burn infested host material.
    6. Notify state/federal agricultural agencies.
    """,
    "aquatic": """
    Standard Protocol for Invasive Aquatic Species:
    1. Close affected water body to boats/recreation to prevent spread.
    2. Inspect all outgoing vessels (Clean, Drain, Dry).
    3. Mechanical harvesting or benthic barriers for plants.
    4. Chemical treatment (aquatic-safe herbicides/pesticides) if contained.
    5. Electrofishing or netting for invasive fish.
    6. Long-term monitoring of dissolved oxygen and native species recovery.
    """
}

def get_playbook(species_type: str = "plant") -> str:
    return PLAYBOOKS.get(species_type.lower(), PLAYBOOKS["plant"])

def send_agency_alert(
    to_emails: List[str],
    subject: str,
    body: str
) -> bool:
    if os.getenv("ALERT_ENABLED", "false").lower() != "true":
        print(f"ALERTS DISABLED. Would have sent to {to_emails}: {subject}")
        return False

    sender = os.getenv("ALERT_SENDER_EMAIL")
    password = os.getenv("ALERT_APP_PASSWORD")
    
    if not sender or not password:
        print("ALERT CONFIG MISSING (email/password).")
        return False

    msg = MIMEText(body)
    msg['Subject'] = f"[ALIENBUSTER ALERT] {subject}"
    msg['From'] = sender
    msg['To'] = ", ".join(to_emails)

    try:
        # Assuming Gmail or standard TLS
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(sender, password)
            server.sendmail(sender, to_emails, msg.as_string())
        return True
    except Exception as e:
        print(f"FAILED TO SEND ALERT: {e}")
        return False
