# Apex Lifts — design brief

Apex Lifts is an iOS app where lifters record a lift at their gym, other members verify the video, and the heaviest approved lift holds a title at that gym: Bench King, Squat King, Deadlift King. Operated by Embalabala Enterprises (Washington LLC).

## What is in this kit
- `app.html` — the complete working app as one file (open it in a browser; it connects to the live backend). Every screen, color and font is in here.
- `app.js`, `extra.css` — the same app's code split out, for reading. CSS tokens are at the top of the `<style>` block in app.html.
- `legal/index.html` — privacy policy and terms page, same brand.
- Live prototype: https://claude.ai/artifact/772ALNr4YdTuDEPRgWXqPa

## Current visual system (keep or improve, but stay consistent)
- Dark UI. Background #0F1012. Surfaces #17181B and #1E1F23. Text #F3EFE6, secondary #B8B3A8, muted #7D7970.
- Accent: acid green #C9F23A (primary buttons, the current user). Gold #F0C25A marks titles and crowns. Warning #F2B04A.
- Fonts: Barlow Condensed 600/700/800 for headings and big numbers; Barlow 400–700 for body. Both on Google Fonts.
- Screens: map of gyms with pins, gym board (three titles + top lifts), submit lift (video + weight), verifier review queue, leaderboard (gym / nearby / state / US), profile with notifications, sign-in.

## Deliverables needed for the App Store
1. App icon: one PNG, 1024×1024, square corners, no transparency, no small text. Must read at 60 px.
2. Screenshots: 3 to 10 PNGs at 1320×2868 (iPhone 6.9"). Suggested order: map → gym board → submit lift → verify → leaderboard. Short headline per frame is fine.
3. Optional: wordmark lockup for the sign-in screen; 1200×630 share image.

## Constraints
- The app name is Apex Lifts. Bundle ID com.gymtitles.app is internal and never shown.
- Do not invent lifter names or records in screenshots that look like real data; use obviously illustrative handles.
- Don't redesign the data model (three lifts, one title each per gym). Visual polish and marketing assets only.
