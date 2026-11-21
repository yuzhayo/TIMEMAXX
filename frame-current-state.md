# Frame application — current state

## Status

`frame/` is a standalone Windows/Electron photo-frame application. It builds and
runs from a clean repository checkout and does not import, build, or launch
`ui-control` or `engine`.

The active application currently provides:

- a custom native window and taskbar identity;
- configuration-driven section and control assembly;
- Load, explicit image-file drop, Reset, and Save;
- photo Rotation, Size, Placement, drag, and wheel operations;
- Undo/Redo history;
- separate inspection pan/zoom state;
- exact PNG/JPEG exports at 1200×1600, 2400×3200, and 3024×4032;
- Bottom Bar operation messages and structured local diagnostics;
- development-only layout inspection.

There are four configured sections, sixteen configured instances, and fifteen
enabled instances.

## Run from a clean clone

Prerequisites:

- Node.js/npm;
- Rust/Cargo;
- Windows for the native Frame window and Windows pointer proof.

From `frame/`, either run:

```bat
start.cmd
```

`start.cmd` runs `npm ci` automatically when Electron dependencies are absent,
then builds the renderer and Rust worker before launching Frame.

Equivalent commands:

```bat
npm.cmd ci
npm.cmd start
```

Useful focused commands:

```bat
npm.cmd run build
npm.cmd run inspect
npm.cmd run test:contract
npm.cmd run test:image
npm.cmd run test:rotation
npm.cmd run test:popover
npm.cmd run test:size-controls
npm.cmd run test:bar-layout
npm.cmd run test:bottom-bar
npm.cmd run test:guardrails
npm.cmd run test:files
npm.cmd run test:layout
npm.cmd run test:inspection
npm.cmd run test:review-fixes
npm.cmd run test:window-swap
```

Generated dependencies, builds, runtime profiles, logs, and worker artifacts stay
under ignored Frame directories.

## Window and layout

- Startup width is 934 DIP.
- Startup and vertical maximize use the current monitor work area, excluding the
  taskbar, and align to the right edge.
- Restore returns to the previous bounds.
- Windows Bar and Action Bar each occupy 4% of window height.
- Frame/body takes the remaining height above the content-sized Bottom Bar.
- Bottom Bar expands upward with wrapped content and uses 1% vertical padding.
- Minimize is hidden. Vertical maximize/restore and Close are visible.
- Artwork is used by the native window/taskbar/pin only; it is not rendered as a
  layout control.
- Windows taskbar identity is `com.yuzha.timemaxx.frame`.

`sectionLayout.mode` explicitly selects vertical flow. Parent sections own sibling
order, lanes, external gaps, and named vertical allocations. Internal File,
Rotation, and Size rows use the shared configured-row mechanism.

## Active controls

### Windows Bar

- Undo
- Redo
- current filename
- Placement: Fit, Fill, Center
- vertical maximize/restore
- Close

### Action Bar

- Rotation: rotate left, editable degree value, rotate right, popup slider
- Size: decrease, percentage value, increase, popup slider
- standalone/orphan Edit button with pencil icon; no command attached
- FileControls: Load, Reset, Save
- configured separators

### Frame/body

- photo preview canvas
- pointer-transparent file-drop target

### Bottom Bar

- one operation/diagnostic text outlet

## Input behavior

- Ctrl+S invokes Save.
- Ctrl+Z invokes Undo.
- No Ctrl+O or Redo shortcut is implemented.
- Left drag moves the photo only inside the configured frame.
- Middle drag or Space+left drag pans inspection state across the canvas.
- Normal wheel changes photo size.
- Ctrl wheel rotates.
- Alt wheel moves horizontally.
- Shift wheel moves vertically.
- Text editing, controls, menus, popovers, dialogs, and native busy state block
  conflicting preview input through one shared interaction policy.
- Photo transforms affect exported photo content; inspection transforms do not.

## File and export behavior

Load and file drop share one source-validation and replacement path. A replacement
is prepared, transferred, decoded, accepted, and finalized through an explicit
ticket. Failed handoff retains the previous preview, document, history, and
full-resolution export identity.

Successfully loaded original files are protected from overwrite. Save supports
PNG and JPEG. An empty scene exports a black frame and proposes
`black-frame-export.png`; a loaded scene proposes a filename based on its photo.

Frame owns a persistent local Rust image worker for decode/orientation, preview
preparation, full-resolution rendering, matte composition, and encoding. Normal
application close settles pending replacement work and shuts the worker down.

## Configuration and discovery

`frame/config.json` owns:

- section and instance identities;
- parent/folder relationships and enabling;
- bounds, percentages, spacing, padding, alignment, typography, colors, icons,
  borders, shadows, and visual states;
- Rotation, Size, view, input, output, window, and development-inspection settings.

Vite discovers control modules from their assigned folders at build time. Each
module exports a stable component ID independent of its filename. Validation sees
the complete catalog before any component mounts. Invalid or conflicting controls
are logged and isolated without inventing fallback parents or visuals.

The shared UI mechanisms under `components/` are:

- `ActionButton.jsx` — common configured button/icon host;
- `AdjustmentControls.jsx` — common Rotation/Size composition and gesture host;
- `ConfiguredRow.jsx` — JSON order, proportional row slots, and containment;
- `ConfiguredPopover.jsx` — popup placement, size, offsets, and dismissal;
- `ConfiguredContent.mjs` — nested text/slot state routing;
- `appearance.mjs` — resolved config-to-style translation.

## Diagnostics and inspection

`LayoutDiagnostics.mjs` owns diagnostic identity, deduplication, readable messages,
repeat counts, and delivery. `DiagnosticLog.cjs` only persists records locally.

The Bottom Bar shows a concise latest issue with owner, reason, and recovery action.
Full records retain component/instance/parent identity, source/config paths,
expected/actual values, timestamps, action, operation, and repeat count. No toast
or floating diagnostic banner is implemented.

Development inspection can outline sections/components and show component ID,
instance ID, parent ID, and source filename. It is disabled in normal use and does
not intercept controls.

## Main ownership map

```text
frame/
├── config.json
├── desktop/
│   ├── main.cjs
│   ├── FrameWindow.cjs
│   ├── preload.cjs
│   ├── ImageFileDialogs.cjs
│   ├── ImageWorker.cjs
│   └── DiagnosticLog.cjs
├── logic/
│   ├── FrameSession.mjs
│   ├── PhotoState.mjs
│   ├── PhotoHistory.mjs
│   ├── PhotoOperations.mjs
│   ├── ImageFileActions.mjs
│   ├── InteractionPolicy.mjs
│   ├── KeyboardShortcuts.mjs
│   ├── ViewState.mjs
│   ├── ViewOperations.mjs
│   └── WindowActions.mjs
├── view/
│   ├── main.jsx
│   ├── layout/
│   ├── preview/
│   └── window/
└── image-worker/
    └── src/
        ├── main.rs
        ├── protocol.rs
        ├── session.rs
        ├── photo.rs
        └── export.rs
```

## Current boundaries

- Frame owns only standalone photo/window/file/export behavior.
- `ui-control/` owns input facts, settings, and its controls.
- `engine/` owns normalized overlay content and headless prepared output.
- Combined photo/overlay routing, accepted revisions, stale-overlay rejection, and
  combined Save belong to a future background orchestrator.
- The orchestrator, optional Bottom Bar Info control, export-size UI, overlays,
  notices, and layer integration are not implemented.
- Future work starts only from a new explicit user request; empty skeleton files do
  not define a work queue.

## Current clean-checkout evidence

The committed package has been exported without local untracked files and verified
with:

- fresh `npm ci`;
- full renderer and Rust worker build;
- 30/30 current JavaScript contract/Rotation tests;
- 6/6 Rust worker tests;
- real Electron launch with all fourteen enabled instances;
- real image Load and 1200×1600 PNG export;
- zero startup diagnostics or renderer errors;
- normal owned-worker shutdown.
