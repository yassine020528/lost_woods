# Lost Woods

Lost Woods is a browser-based horror game built with React, TypeScript, and Vite. You cross a haunted forest, collect five keys, unlock an abandoned building, and rescue a kidnapped baby before the ritual is completed.

The project is not a generic React starter anymore. It is a custom canvas-driven game with its own game loop, procedural forest generation, enemy AI, audio layering, menu flows, intro/outro sequences, and an indoor final area.

[▶ Play Demo](https://lost-woods.netlify.app) &nbsp;·&nbsp;
## Premise

The story follows a rescue mission through the Khmir forest in North Africa. A cult has hidden a baby inside an abandoned building deep in the woods. The building is locked, five keys are scattered across the forest, and hostile entities begin hunting you when your flashlight exposes you.

The game mixes fictional horror with real-world inspiration around child abduction and exploitation for witchcraft-related beliefs. The info and credits screens in-game make that distinction explicit.

## Gameplay

- Explore a dark forest generated on a tile map.
- Collect all 5 keys to unlock the building door.
- Avoid 5 roaming monster types: `stalker`, `spider`, `skull`, `wraith`, and `wolf`.
- Manage 3 lives and a stamina bar while moving and sprinting.
- Use your flashlight carefully because monsters react to it.
- Cast a purge spell outdoors with a cooldown to destroy nearby threats.
- Enter the building after unlocking it and save the baby to reach the ending.

## Controls

- `WASD` or arrow keys: move
- `Shift`: sprint
- `F`: toggle flashlight
- `E`: cast the outdoor spell / save the baby indoors
- `Esc`: pause or resume
- Mouse: menu navigation and intro/outro progression

## Features

- Full-screen canvas-based rendering inside a React app
- Procedurally generated forest layout with reachable key placement
- Separate outdoor and indoor scenes
- HUD for keys, lives, stamina, hints, and spell cooldown
- Intro, death, and rescue-ending cinematic screens
- Layered horror audio, including ambient synthesis plus bundled sound assets
- Mute support from menu and in-game UI
- Info and credits screens integrated into the main menu

## Tech Stack

- React 19
- TypeScript
- Vite
- ESLint
- HTML5 Canvas
- Browser audio via `Audio`, `AudioContext`, and custom controllers

## Project Structure

```text
src/
  App.tsx
  features/lostWoods/
    LostWoodsGame.tsx        # Main UI shell and overlays
    useLostWoodsGame.ts      # Core game state, loop, input, rendering, logic
    buildingSceneData.ts     # Indoor map and decor layout
    audio.ts                 # Procedural ambient/game audio helpers
    InfoContent.tsx          # In-game archive/info screen
    constants.ts             # Gameplay constants
    types.ts                 # Shared types
public/
  *.mp3                      # Menu, ambient, and event audio assets
  *.png                      # Info/outro/favicons and supporting images
```

## Getting Started

### Requirements

- Node.js 18+ recommended
- npm

### Install

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

Then open the local Vite URL in your browser.

### Build for Production

```bash
npm run build
```

### Preview the Production Build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Notes

- Audio playback starts after user interaction, which is expected for browser autoplay rules.
- Images used in the game are AI-generated, as stated in the in-game credits.
- Built output is generated in `dist/`.
