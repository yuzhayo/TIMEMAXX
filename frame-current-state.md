# Frame application — current state

## Status

`frame/` is a Windows/Electron photo-frame application. Its photo build, editing,
preview and export remain standalone. The pencil button has one launch-only link
to a frameless Input window owned by `ui-control/`; Input renders baked section
cards — the enabled language section whose dropdown selects the global
layout language (English/Indonesian), a code generator, a time section and a
date section —
with no task content, engine or data integration.

The active application currently provides:

- a custom native window and taskbar identity;
- configuration-driven section and control assembly;
- Load, explicit image-file drop, Reset, and Save;
- photo Rotation, Size, Placement, drag, and wheel operations;
- Undo/Redo history;
- separate inspection pan/zoom state;
- exact PNG/JPEG exports at 1200×1600, 2400×3200, and 3024×4032;
- Bottom Bar operation messages and structured local diagnostics;
- development-only layout inspection;
- toggling a frameless Input window from the pencil button; Input renders the
  enabled shared section cards (a language dropdown, a code generator, a time
  section and a date section; the placeholder chassis is configured but disabled).

Frame has four configured sections, sixteen configured instances, and fifteen
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
npm.cmd run test:input-screen
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

Prepare the Input renderer separately from `@APPS`:

```bat
ui-control\build.cmd
```

It installs Input's locked dependencies on first use and builds only Input. Then
use Frame's pencil button. Frame still builds/starts/exports independently; missing
Input build output is reported without stopping Frame.

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
- standalone/orphan Edit button with pencil icon; toggles the Input window
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

The shared UI mechanisms under `components/` include:

- `ActionButton.jsx` — common configured button/icon host;
- `AdjustmentControls.jsx` — common Rotation/Size composition and gesture host;
- `ConfiguredRow.jsx` — JSON order, proportional row slots, and containment;
- `ConfiguredPopover.jsx` — popup placement, size, offsets, and dismissal;
- `ConfiguredContent.mjs` — nested text/slot state routing;
- `appearance.mjs` — resolved config-to-style translation.
- `ComponentDiscovery.mjs` — shared build-time module catalog normalization.
- `LayoutDiagnostics.mjs` / `DiagnosticLog.cjs` — shared diagnostic identity and persistence.

## Diagnostics and inspection

`components/LayoutDiagnostics.mjs` owns diagnostic identity, deduplication, readable
messages, repeat counts, and delivery. `components/DiagnosticLog.cjs` only persists
records locally. Frame keeps its old import paths as compatibility adapters.

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
- `ui-control/` owns its native window, React/MUI renderer, config, its own
  per-section selection state and the generated code. `screen.cjs`
  is its public window-only contract; Frame loads it only on a pencil click.
  Input owns its own locked dependencies and Vite build, with no Frame build
  dependency. It renders configured section cards (a language dropdown, a code
  generator, a time section and a date section) and has no task content or data.
- Input is one non-modal frameless window: no native caption/buttons/title text or
  reserved Windows-Bar area. Pencil clicks alternate open/close, including rapid
  clicks. Closing Input leaves Frame running; closing Frame closes Input. Toggling
  Input does not change photo/history/inspection state.
- `ui-control/config.json` owns the width/height percentages, their bases, placement,
  native-frame flags, title metadata and background. On each opening Input uses 40%
  of current Frame width, 100% of the current monitor work-area height excluding
  the taskbar, work-area top alignment, and its right edge touching Frame's left
  boundary: `[ Input ][ Frame ]`. Computed bounds use native DIP; no stored manual
  coordinates. Input cannot resize through a native thick-frame border.
- If there is insufficient room left of Frame, Input reports that placement failure
  without moving Frame, changing the approved ratio or inventing another position.
- `ui-control/view/index.html` hosts the renderer. The content area is empty:
  `config.json` declares no sections, languages or layouts. Adding sections or
  generator behavior is a future explicit request.
- Input's scoped preload exposes only config bootstrap and diagnostic delivery,
  never Frame commands or filesystem/Node access. Its local diagnostic outlet is
  visible only for issues; development inspection is off in normal use.
- Missing/invalid Input is reported through Frame's existing Bottom Bar diagnostics;
  it does not prevent Frame startup or standalone export.
- `engine/` now has one Rust parent (`src/lib.rs`) and flat children: `shield`,
  `codeDivider`, `codeLabel`, `codeColon` and `codeStamp`. The parent only reads
  JSON and rasterises; each child calculates its own geometry, text and
  placement. Shared child-only helpers live in `_layout.rs` (skipped by the
  glob). The parent writes z-ordered transparent 1200x1600 PNGs and logs missing
  input/children or child failures in `engine/log.json`. Input only supplies the
  code; the label child generates `Photo Code` or `Kode Foto` by language. The bridge polls both JSON files by content hash and
  pushes fresh layers on change, so a generated code or language switch appears
  in Frame immediately. Geometry is measured from the operator's 1200x1600
  Indonesian stacked export: shield x31..66/y1527..1568, divider
  x31..538/y1509. Photo-code typography follows `timemark-web` exactly:
  RobotoCondensed-Bold label, RobotoCondensed-Regular colon and code, 12dp,
  white70 under row alpha 0.7, with the code starting 2dp after the colon.
  Frame carries the PNGs
  through `desktop/LayerReceiver.cjs` and stacks them in `PreviewPainter` without
  interpreting stamp content. A child error or bad input hides only that section.
- Combined photo/overlay export, accepted revisions, stale-overlay rejection and
  combined Save still belong to a future background orchestrator. The optional
  Bottom Bar Info control and export-size UI remain out of scope.
- Future work starts only from a new explicit user request; empty skeleton files do
  not define a work queue.

## Input screen verification

`npm.cmd run test:input-screen` checks the window-only command and the real Electron
pencil path: a frameless Input with the enabled shared section cards (header
toggle, body mount, auto-compact below the configured slot, header height from
configured paddingY, language dropdown swapping
the locale layout, the last selection restored from `ui-control/state.json` and
saved per section, a generated code and the time bucket restored from the
generic `ui-control/code.json` envelope, every time change auto-saved, double-click copying, Generate replacing that one code bucket, a shared
24/12-hour dropdown, three editable value boxes where four typed digits
normalize to HH:MM and double-click copies, a picker attached to each box
(hidden scrollbars, mouse-wheel scrolling), range Generate, colon-only time
display, a DD/MM/YYYY date box with MUI's full-month DateCalendar and locale
day/month dropdowns offering Senin/Sen and Monday/Mon names, every date change
auto-saved in `sections.date`, damaged state falling back to defaults), 40% width at Frame startup/minimum sizes, full work-area height and
adjoining-left bounds, JSON-driven geometry/background, toggle parity during
rapid clicks, unchanged Frame state, failure isolation and parent-window cleanup.
Artifacts stay in
ignored `frame/.runtime/checks/input-screen/`.

From `frame/`, `node tests/engine-layers-proof.mjs` checks that the running Frame
can ask the parent engine for its current layer list, that the list contains the
discovered `shield` and `codeStamp` children at 3:4 1200x1600 with PNG data,
then edits `code.json` and asserts the pushed layer changes without a restart,
capturing `frame/.runtime/checks/engine-layers/frame-with-layers.png` as visual
proof. Direct engine probes covered auto-registration of a temporary child, a
panicking child and a missing `code.json`: each failure was logged in
`engine/log.json` and only its own section disappeared.

From `ui-control/`, `npm.cmd run test:contract` checks the enabled-card baseline
config, window geometry, discovery contract, the per-section state rules
(declared keys only, no invented fallback, disabled sections leaving no bucket)
and the ported 14-character base-24 generator rules. Dependencies, built
renderer, `state.json`, `code.json` and local logs stay ignored there.
