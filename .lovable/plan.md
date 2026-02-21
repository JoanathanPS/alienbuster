

# Alien Buster -- Upgrade Plan

## Summary

Enhance the existing Alien Buster app with a dual photo input flow (camera + gallery upload), real species images on the "How it works" page, and UI polish across all screens.

---

## Changes

### 1. New PhotoInput Component

Create `src/components/PhotoInput.tsx` -- a full-screen overlay that replaces the current direct-to-camera flow on the Home page.

- Two side-by-side buttons (stacked on small screens):
  - "Take Photo" (orange, camera icon) -- opens CameraView
  - "Upload from Gallery" (secondary, upload icon) -- triggers a hidden `<input type="file" accept="image/*">`
- After a photo is obtained (from either method), show full-screen preview with:
  - "Retake / Choose Another" (secondary button)
  - "Continue" (primary orange button) -- stores photo in sessionStorage and navigates to `/submit`

### 2. Update CameraView

Modify `src/components/CameraView.tsx`:
- Change "Use this photo" button label to "Continue" for consistency
- Keep existing camera logic (it works well)

### 3. Update Home Page (Index.tsx)

- Replace `setShowCamera(true)` with `setShowPhotoInput(true)` to open the new PhotoInput overlay instead of going directly to camera
- Keep hero section and info cards as-is

### 4. Update "How It Works" Page

Replace emoji placeholders with real images from Unsplash/Wikimedia for the three invasive species:
- Kudzu Vine -- use a high-quality URL of kudzu covering trees
- Burmese Python -- use a photo of a Burmese python
- Lionfish -- use a photo of a lionfish

Each species card will show an image with rounded corners, the species name, and a caption below.

### 5. Update Submit Page

- Add the TODO comment for ML integration: `// TODO: After photo upload, call backend API /api/identify (Python BioCLIP) for species detection, then save species/confidence to DB`
- This comment already partially exists; will make it match the exact requested wording.

### 6. Minor UI Polish

- Ensure dark mode is the default by updating `useTheme.ts` to default to `"dark"` when no system preference or localStorage value is found
- No structural changes to BottomNav, MyReports, or ReportMap -- they already work well

---

## Technical Details

### New file: `src/components/PhotoInput.tsx`

```text
Props: { onPhotoReady: (dataUrl: string, blob: Blob) => void; onClose: () => void }

State:
- mode: "choose" | "camera" | "preview"
- photoDataUrl / photoBlob

"choose" mode:
  - Two buttons side-by-side (grid-cols-2 on md+, grid-cols-1 on small)
  - "Take Photo" sets mode to "camera"
  - "Upload from Gallery" triggers file input, reads file as dataUrl, sets mode to "preview"

"camera" mode:
  - Renders existing CameraView
  - onPhotoTaken callback sets photo and switches to "preview"

"preview" mode:
  - Full-screen image preview
  - "Choose Another" resets to "choose"
  - "Continue" calls onPhotoReady(dataUrl, blob)
```

### Modified files

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Replace CameraView usage with PhotoInput |
| `src/components/CameraView.tsx` | Minor label tweak |
| `src/pages/HowItWorks.tsx` | Replace emoji cards with image cards using Unsplash URLs |
| `src/pages/Submit.tsx` | Update TODO comment wording |
| `src/hooks/useTheme.ts` | Default to dark theme |

### No database or storage changes needed

The existing `reports` table and `reports-photos` bucket are already correctly configured.

