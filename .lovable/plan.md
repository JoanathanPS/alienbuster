

# Alien Buster -- Major Feature Upgrade

## Summary

Add a Hotspots Map page with clustered report markers, a Satellite Vegetation Check placeholder on the success screen, an Admin Review page for verifying/rejecting reports, and colored status badges on My Reports.

---

## Changes

### 1. Hotspots Map Page

New page at `/hotspots` with a full-screen interactive Leaflet map.

- Fetch all reports from the `reports` table
- Plot circle markers: orange for "pending", green for "verified", red for "rejected"
- Use Leaflet's built-in marker clustering (via the `leaflet.markercluster` library)
- On marker click, show a popup with: photo thumbnail, date, notes, status, and coordinates
- Show a loading spinner while reports are being fetched
- Map centers on the user's location (if available) or a world view

### 2. Bottom Navigation Update

Add "Hotspots" tab between "My Reports" and "How it works":
- Icon: `MapPin` from lucide-react
- Path: `/hotspots`
- Move theme toggle to a smaller icon button in the corner to keep nav clean with 4 tabs

### 3. Satellite Vegetation Check (Success Screen)

On the Submit success screen, add a card below the map:
- Show spinner "Analyzing land-cover changes..." for 3 seconds
- Then show a randomly picked result: either "Unusual vegetation change detected (NDVI drop)" with a red/orange warning, or "Normal vegetation pattern" with a green check
- Include a small placeholder colored gradient bar to simulate NDVI visualization
- Comment: `// TODO: Replace placeholder with real Google Earth Engine NDVI change detection via backend API`

### 4. Admin Review Page

New page at `/admin-review` (not in bottom nav, accessed via URL):
- Fetch all reports with `status = 'pending'`
- List each report as a card with: photo, date, user, location, notes
- Two action buttons per card: "Verify" (green) and "Reject" (red)
- On click, update the report's `status` in the database and show a toast
- Comment: `// TODO: Later add real auth so only experts can access review page`

**Database change needed**: Add an RLS policy allowing anyone to UPDATE the `status` column on the `reports` table. (Currently only INSERT and SELECT policies exist.)

### 5. Status Badges on My Reports

Replace the plain text status with colored badges:
- "pending" -- orange/amber background
- "verified" -- green background
- "rejected" -- red/destructive background

### 6. Router Update

Add routes for `/hotspots` and `/admin-review` in `App.tsx`.

---

## Technical Details

### Database Migration

```sql
-- Allow public updates to reports (status only for now)
CREATE POLICY "Anyone can update report status"
ON public.reports
FOR UPDATE
USING (true)
WITH CHECK (true);
```

This is intentionally permissive since there is no auth system yet. The TODO comment on the admin page notes that real auth should be added later.

### New Dependencies

- `leaflet.markercluster` -- for marker clustering on the Hotspots map. Will need to import its CSS as well.

### Files Created

| File | Purpose |
|---|---|
| `src/pages/Hotspots.tsx` | Full-screen map with clustered report markers |
| `src/pages/AdminReview.tsx` | Pending reports list with verify/reject actions |

### Files Modified

| File | Change |
|---|---|
| `src/App.tsx` | Add routes for `/hotspots` and `/admin-review` |
| `src/components/BottomNav.tsx` | Add Hotspots tab with MapPin icon |
| `src/pages/Submit.tsx` | Add satellite vegetation check card on success screen |
| `src/pages/MyReports.tsx` | Add colored status badges (pending/verified/rejected) |

### Hotspots Map Component Structure

```text
Hotspots.tsx:
  - Fetch all reports via supabase.from("reports").select("*")
  - Initialize Leaflet map with OSM tiles
  - Create MarkerClusterGroup
  - For each report with lat/lng:
    - Create circleMarker with color based on status
    - Bind popup with HTML: photo img, date, notes, status badge
  - Add cluster group to map
  - Show Loader2 spinner during fetch
```

### Satellite Card Structure

```text
On success screen (Submit.tsx):
  State: satelliteLoading (true), satelliteResult (null)
  
  useEffect on success:
    - setTimeout 3s
    - Pick random: "anomaly" or "normal"
    - Set result
  
  UI:
    - Card with Satellite icon
    - If loading: spinner + "Analyzing land-cover changes..."
    - If anomaly: orange warning with NDVI drop message
    - If normal: green check with normal pattern message
    - Colored gradient bar (CSS gradient: red -> yellow -> green)
```

### No changes to existing components

PhotoInput, CameraView, LocationInput, ReportMap, and HowItWorks remain unchanged.
