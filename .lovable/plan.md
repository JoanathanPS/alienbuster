

# Alien Buster -- Upgrade Plan

## Summary

Enhance the existing app with a dual photo input flow (camera + gallery upload), replace emoji placeholders with real species images, and ensure dark mode is the default.

The database, storage bucket, PWA manifest, service worker, bottom nav, My Reports page, Submit page, and map component are already built and working. No backend changes needed.

---

## Changes

### 1. New Component: PhotoInput

Create `src/components/PhotoInput.tsx` -- a full-screen overlay with two input methods.

- **"choose" mode**: Two buttons in a responsive grid (side-by-side on wider screens, stacked on small):
  - "Take Photo" (orange, Camera icon) -- switches to camera mode
  - "Upload from Gallery" (secondary, Upload icon) -- triggers hidden `<input type="file" accept="image/*">`
  - Close button (X) in top-right corner
- **"camera" mode**: Renders existing `CameraView`; on photo taken, switches to preview mode
- **"preview" mode**: Full-screen image preview with:
  - "Choose Another" (secondary) -- resets to choose mode
  - "Continue" (orange) -- stores photo in sessionStorage and calls `onPhotoReady`

### 2. Update Home Page (Index.tsx)

- Replace direct `CameraView` usage with new `PhotoInput` overlay
- Change state from `showCamera` to `showPhotoInput`
- Keep hero section and info cards unchanged

### 3. Update "How It Works" Page (HowItWorks.tsx)

Replace emoji-based species cards with image cards using free Unsplash photos:
- **Kudzu Vine**: Dense vine covering trees (Unsplash URL)
- **Burmese Python**: Large snake in grass (Unsplash URL)
- **Lionfish**: Colorful spiky fish underwater (Unsplash URL)

Each card shows a rounded image (aspect-video), species name, and description caption below.

### 4. Default to Dark Theme (useTheme.ts)

Change the fallback when no stored preference and no system preference from `"light"` to `"dark"`.

### 5. Update Submit Page TODO Comment

Ensure the ML integration placeholder reads:
```
// TODO: After photo upload, call backend API /api/identify (Python BioCLIP) for species detection, then save species/confidence to DB
```

---

## Technical Details

### PhotoInput Component Structure

```text
Props:
  onPhotoReady: (dataUrl: string, blob: Blob) => void
  onClose: () => void

State:
  mode: "choose" | "camera" | "preview"
  photoDataUrl: string | null
  photoBlob: Blob | null

Flow:
  "choose" ->
    Take Photo -> "camera" (renders CameraView)
    Upload -> file input onChange -> read as dataUrl -> "preview"
  "camera" ->
    CameraView.onPhotoTaken -> store dataUrl+blob -> "preview"
    CameraView.onClose -> back to "choose"
  "preview" ->
    "Choose Another" -> reset photo, back to "choose"
    "Continue" -> call onPhotoReady(dataUrl, blob)
```

### Files Modified

| File | Change |
|---|---|
| `src/components/PhotoInput.tsx` | New file -- dual photo input overlay |
| `src/pages/Index.tsx` | Use PhotoInput instead of CameraView |
| `src/pages/HowItWorks.tsx` | Replace emojis with real Unsplash images |
| `src/hooks/useTheme.ts` | Default to "dark" |
| `src/pages/Submit.tsx` | Update TODO comment for ML integration |

### No Database or Storage Changes

The existing `reports` table and `reports-photos` bucket are already correctly configured. No migrations needed.

