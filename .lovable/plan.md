

# Alien Buster -- Feature Upgrade Plan

## Summary

Add a fake species detection UI to the Submit page, improve the "How It Works" species cards with aspect-square images, and polish touch targets and toast feedback across the app. The PhotoInput and CameraView components already work correctly and need only minor tweaks.

---

## Changes

### 1. Fake Species Detection on Submit Page

Add a simulated BioCLIP analysis that runs after the photo loads on the Submit page.

- When the photo preview appears, show an "Analyzing with BioCLIP..." spinner for 2-3 seconds
- After the delay, display a detection result card:
  - Randomly pick from a list of species names (e.g., "Kudzu Vine", "Burmese Python", "Lionfish", "Asian Carp", "Unknown")
  - Generate a random confidence between 70-95%
  - If species is not "Unknown", show an orange warning banner: "Potential invasive species -- report submitted for review"
- Add state variables: `detectionLoading`, `detectedSpecies`, `detectedConfidence`
- Add comment: `// TODO: Replace fake detection with real call to /api/identify (Python BioCLIP backend) after photo upload`

### 2. How It Works -- Aspect-Square Species Images

Update the species image cards from `aspect-video` to `aspect-square` for a more card-like presentation, matching the user's request.

### 3. PhotoInput -- Add capture attribute

Add `capture="environment"` to the file input element so mobile devices default to the rear camera when using "Upload from Gallery".

### 4. General Touch Target Polish

- Increase bottom action buttons in PhotoInput preview to `min-h-[48px]`
- Increase the Submit button already has `h-14` (56px) which is good
- Add `min-h-[48px]` to LocationInput retry button
- Add sonner toast when location is successfully fetched: `toast.success("Location fetched!")`

---

## Technical Details

### Submit.tsx Changes

New state and fake detection logic:

```text
State additions:
  detectionLoading: boolean (default true)
  detectedSpecies: string | null
  detectedConfidence: number | null

On photo load (useEffect):
  - Set detectionLoading = true
  - setTimeout 2-3s random delay
  - Pick random species from list
  - Pick random confidence 70-95
  - Set results, detectionLoading = false

UI additions (below photo preview):
  - If detectionLoading: spinner + "Analyzing with BioCLIP..."
  - If result ready: card showing species name + confidence %
  - If species != "Unknown": orange warning banner
```

### Files Modified

| File | Change |
|---|---|
| `src/pages/Submit.tsx` | Add fake detection UI with loading state, result card, and warning banner |
| `src/pages/HowItWorks.tsx` | Change `aspect-video` to `aspect-square` on species images |
| `src/components/PhotoInput.tsx` | Add `capture="environment"` to file input, ensure min-h-[48px] on buttons |
| `src/components/LocationInput.tsx` | Add toast on successful location fetch, increase retry button touch target |

### No Database or Storage Changes

No backend modifications needed. The fake detection is purely client-side UI.

