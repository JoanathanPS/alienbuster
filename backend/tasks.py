from typing import List, Optional, Dict, Any

from backend.db import get_conn, _utcnow_iso

def list_tasks(status: Optional[str] = None, assigned_to: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    try:
        sql = "SELECT * FROM tasks"
        params = []
        where = []
        if status:
            where.append("status = ?")
            params.append(status)
        if assigned_to:
            where.append("assigned_to = ?")
            params.append(assigned_to)
            
        if where:
            sql += " WHERE " + " AND ".join(where)
            
        sql += " ORDER BY priority DESC, created_at ASC"
        
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def auto_create_tasks_from_outbreaks() -> int:
    """
    Scans for high-risk outbreaks that don't have tasks yet and creates them.
    """
    conn = get_conn()
    try:
        # Find outbreaks with mean_risk > 0.8 that are active (investigating/confirmed)
        # and do NOT have an open task associated.
        
        # 1. Get candidate outbreaks
        candidates = conn.execute(
            """
            SELECT id, species, mean_risk, centroid_lat, centroid_lon 
            FROM outbreaks
            WHERE status IN ('investigating', 'confirmed')
              AND mean_risk >= 0.75
            """
        ).fetchall()
        
        created_count = 0
        now = _utcnow_iso()
        
        for ob in candidates:
            # Check if task exists
            exists = conn.execute(
                "SELECT 1 FROM tasks WHERE outbreak_id = ? AND status != 'resolved'", 
                (ob["id"],)
            ).fetchone()
            
            if exists:
                continue
                
            # Create task
            priority = 'critical' if ob["mean_risk"] >= 0.9 else 'high'
            agency = "Local Environmental Dept"
            assigned_to = "field_team_alpha"
            
            notes = f"Auto-generated task for {ob['species']} outbreak.\nRisk Level: {ob['mean_risk']:.2f}\nLocation: {ob['centroid_lat']:.4f}, {ob['centroid_lon']:.4f}\nPlease investigate immediately."
            
            conn.execute(
                """
                INSERT INTO tasks (outbreak_id, assigned_to, agency, priority, status, created_at, notes)
                VALUES (?, ?, ?, ?, 'open', ?, ?)
                """,
                (ob["id"], assigned_to, agency, priority, now, notes)
            )
            created_count += 1
            
        conn.commit()
        return created_count
    finally:
        conn.close()

def create_task(
    outbreak_id: Optional[int],
    report_id: Optional[int],
    assigned_to: str,
    agency: str,
    priority: str,
    notes: Optional[str] = None,
    due_at: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_conn()
    try:
        now = _utcnow_iso()
        cur = conn.execute(
            """
            INSERT INTO tasks (outbreak_id, report_id, assigned_to, agency, priority, status, created_at, notes, due_at)
            VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)
            """,
            (outbreak_id, report_id, assigned_to, agency, priority, now, notes, due_at)
        )
        task_id = cur.lastrowid
        conn.commit()
        
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()

def update_task(task_id: int, status: str = None, notes: str = None) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    try:
        sets = []
        params = []
        if status:
            sets.append("status = ?")
            params.append(status)
        if notes:
            sets.append("notes = ?")
            params.append(notes)
            
        if not sets:
            return None
            
        sql = f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?"
        params.append(task_id)
        
        conn.execute(sql, params)
        conn.commit()
        
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()
