

# Fix: Photo Preview Buttons Hidden + Detection UI Not Visible

## Problem

After uploading an image in the PhotoInput component, the preview screen uses `flex-1` on the image element. This causes the image to expand and fill the entire screen, pushing the "Choose Another" and "Continue" buttons off the bottom of the viewport. The user only sees the image and doesn't know how to proceed.

## Fix

### 1. PhotoInput Preview Layout (PhotoInput.tsx)

Fix the preview mode so buttons are always visible:

- Remove `flex-1` from the image
- Wrap the image in a container that takes available space but doesn't push buttons away
- Use `overflow-hidden` on the image container and `object-contain` on the image
- Keep the buttons pinned at the bottom with proper padding

The layout should be:
- Image area: fills available space above buttons, image centered within it
- Button bar: always visible at the bottom, never pushed off-screen

### 2. Submit Page Scroll Visibility (Submit.tsx)

No code changes needed here -- the detection UI code is already implemented and working. The issue is entirely in the PhotoInput preview blocking the user from reaching the Submit page.

---

## Technical Details

### File: `src/components/PhotoInput.tsx`

Change the preview mode section (lines 66-86):

**Before:**
```
<div className="fixed inset-0 z-50 flex flex-col bg-background">
  <img src={photoDataUrl} alt="Preview" className="flex-1 object-contain" />
  <div className="flex gap-3 p-4">
```

**After:**
```
<div className="fixed inset-0 z-50 flex flex-col bg-background">
  <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
    <img src={photoDataUrl} alt="Preview" className="max-h-full max-w-full object-contain rounded-xl" />
  </div>
  <div className="flex gap-3 p-4 pb-6">
```

This wraps the image in a flex container that centers it while constraining its size, ensuring the buttons below are always visible on screen.

### Files Modified

| File | Change |
|---|---|
| `src/components/PhotoInput.tsx` | Fix preview layout so buttons stay visible below the image |

### No other changes needed

The detection UI on the Submit page is already implemented and will show once users can actually reach it by clicking "Continue".
