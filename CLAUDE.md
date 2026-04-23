# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Meditation Timer** is a client-side web application for guided breathing exercises and meditation. It's a vanilla HTML/CSS/JavaScript project with no build system—just open `index.html` in a browser to use it.

## Getting Started

- **Run locally:** Open `index.html` directly in a web browser (no server needed)
- **Technologies:** HTML5, CSS3, Vanilla JavaScript (ES6+), Web Speech API, Screen Wake Lock API
- **Browser support:** All modern browsers; fallbacks for older browsers (e.g., silent video for wake lock)

## Architecture

### Core State Machine: Breathing Cycle

The meditation session is structured as an async state machine implemented in `runMeditationCycle()`:

1. **"Get Ready" phase** (3s countdown) - Prepares user before breathing starts
2. **Breathing cycle loop** - Repeats for `totalRounds`:
   - Inhale (configurable duration)
   - Hold after inhale (configurable)
   - Exhale (configurable duration)
   - Hold after exhale (configurable)

Each phase calls `runPhase()`, which:
- Updates UI text with phase name
- Triggers speech synthesis with translated audio prompt
- Updates countdown timer
- Animates the breathing circle (grows on inhale, shrinks on exhale)
- Awaits the phase duration

The loop can be stopped at any time by setting `isRunning = false`.

### Key Components

**script.js** (`script.js`):
- **State management** — `isRunning`, `currentRound`, `totalRounds`, `wakeLock`, `currentAudio`
- **Breathing logic** — `runMeditationCycle()`, `runPhase()`, `delay()`
- **Speech/Audio** — `speak()`, `getTranslatedText()`, voice selection from Web Speech API
- **Settings persistence** — `saveSettings()`, `loadSettings()` (localStorage)
- **Wake lock** — `requestWakeLock()`, `releaseWakeLock()` (keeps screen on during session)
- **UI lifecycle** — `startMeditation()`, `stopMeditation()`, `finishMeditation()`, `resetUI()`

**style.css**:
- CSS variables for colors and transitions (modify `:root` to theme)
- `.grow` class animates breathing circle scale during inhale
- Responsive design for mobile/desktop (max-width: 400px container)

**index.html**:
- Configuration controls: durations, rounds, voice, background sound
- Status display: breathing circle, instruction text, timer, round counter
- Audio elements for background sounds (rain, forest) — sourced from soundjay.com
- Silent video fallback for wake lock on older browsers

### Multi-language Support

- **Translations object** — English (`en`) and Tamil (`ta`) in `translations` constant
- **Language selection** — determined by selected voice's lang code (e.g., `en-US`, `ta-IN`)
- **Adding a new language:**
  1. Add language key to `translations` object with all message keys
  2. Filter for voice lang codes in `populateVoiceList()` 
  3. UI text automatically updates when voice changes (calls `updateStaticText()`)

### Configuration Persistence

- User settings (durations, rounds, voice, sound) saved to localStorage under key `SETTINGS_KEY`
- Settings auto-load on page refresh via `loadSettings()` 
- Settings auto-save on any input change

## Common Tasks

**Add a new background sound:**
1. Add `<audio>` element in `index.html` with unique `id`
2. Add entry to `audioElements` object in script.js
3. Add `<option>` to sound-select dropdown in HTML

**Modify breathing defaults:**
- Change `value` attributes on inputs in HTML (line 24, 28, 32, 36, 40)
- Or adjust defaults in `loadSettings()` fallbacks

**Adjust animation timing:**
- Circle animation duration set dynamically in `runPhase()` to match phase duration
- Override fallback in CSS: `.grow` transform scales from 0.5 to 1.2

**Debug timing issues:**
- `delay()` uses `setTimeout` wrapped in Promise; `clearTimeout` stops it when user clicks Stop
- `updateCountdown()` updates timer every 1000ms independently from delay
- Check browser console for wake lock errors (`console.error` calls in place)

## Accessibility

- ARIA live regions on status display (`aria-live="polite"`)
- Proper semantic HTML (labels for inputs, buttons with descriptive text)
- Min-height on text fields to prevent layout shift during text updates
- High contrast colors with CSS variables

## Browser APIs Used

- **Web Speech API** (`speechSynthesis`) — voice prompts; fallback graceful if unsupported
- **Screen Wake Lock API** (`navigator.wakeLock`) — keeps screen on; falls back to silent video if unavailable
- **localStorage** — persist user settings across sessions
- **Audio API** — background sound playback with `autoplay` + user gesture
