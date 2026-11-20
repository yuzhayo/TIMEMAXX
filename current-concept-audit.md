# Current frame concept and delivery plan

## Target and status

The first standalone `@APPS/frame/` slice is implemented and verified: native
window, four configured sections, discovery/validation before mounting, diagnostics,
inspection and real Undo/Redo history, plus the shared Load/Save file slice with
native dialogs, preview and standalone Rust PNG/JPEG export. Reviewed validation,
capability isolation, relocation and error-origin boundaries are regression-checked.
The approved Rotation slice is now implemented and reviewed: left/right square
shared action buttons, degree input, synchronized MUI slider and configured separator.
Other editing controls, view gestures, full overlays and layer receiving/composition remain
pending. Preserve `output-frame/` as a behavior reference; do not blindly copy it.
The map below remains the comparison target; do not recreate/reconfirm the skeleton.
`AGENTS.md` defines the working rules.

Run from `frame/`: `npm.cmd start` for normal mode or `npm.cmd run inspect` for
development inspection. Normal startup shows the black frame, filename/status and
shared icon-only Load/Save buttons. Undo/Redo start disabled until an edit exists.
Rotation controls start disabled until a photo is loaded. The Action Bar reads
`[Rotate left] [degree input + °] [slider] [Rotate right] | … [Load] [Save]`.
JSON defines ±180° bounds, 0.1° precision/step and 90° button increments.
The degree box starts at one-digit width and expands/shrinks with its text.
Its JSON `textSizing` policy owns character limits and font-relative insets.
Rotation changes photo preview/export only; future prepared layers remain independent.
The active arrangement is Load/Save in Action Bar, Undo/Redo in Windows Bar,
with configured minimize, maximize/restore and X controls in Windows Bar.
Undo/Redo are at the far left, followed immediately by the left-aligned filename.
The filename is a transparent pass-through label over the draggable Windows Bar.
Load/Save have equal wider boxes anchored at the right of Action Bar, with centered
icons. Minimize/maximize/X boxes exactly match Undo/Redo in their common parent.
Windows Bar and Action Bar each use 5% of window height. Buttons use 8% top/bottom
parent-relative insets and 84% height, so the rows have equal control heights and
proportional padding. Action Bar was tightened while retaining essentially the same control height;
Frame/body starts at 10% and takes the remaining height above the content-sized
Bottom Bar; its old fixed 83% allocation is no longer the rendered height.
The native control overlay is off; these custom buttons call normal native
window operations. X shares the exact MUI renderer and preset used by Load/Save.
Loading/replacing an image resets photo history. No fake edits are seeded.
The working rule is to close an existing target-app instance and launch the current
build after finishing changes and focused verification, leaving it open for the user.

## Text-only Bottom Bar

Bottom Bar is the single outlet for operation/progress/success/error text and
readable diagnostic summaries. It contains no buttons, selectors or toast stack.
It defaults to one text line, wraps and expands upward for longer messages, and
shrinks again for shorter text. Frame/body reflows rather than being covered.
Existing diagnostic records, deduplication and local logging remain intact.
Development-only layout inspection remains a separate developer surface.

`presets.status.geometry.paddingY` is **1% per side** of the text outlet's height;
1–2% is the requested range. Font, line height, horizontal placement and error
color remain configured. `FrameInfo.jsx` measures its own text and resolves that
percentage without preferred-height callbacks. Generic section `sizing` supports
`content` and `remaining`; omitted sizing keeps fixed percentage height. Declared
bounds still establish section ordering, horizontal placement and validation
footprints, not the runtime heights of content/remaining sections.

Focused verification: 27 Bottom Bar/contract tests passed, UI build passed, and
native Bottom Bar plus guardrail proofs passed at default/minimum sizes. The bar
measured **17.91px** for one line and **33.81px** for two lines at both sizes.
The proof creates its own photo fixture, checks actual Load success/cancellation,
upward growth/shrink, unchanged top bars, preview reflow, JSON changes to 2%
padding, errors/diagnostics in the bar, logging and invalid-padding isolation.
Native captures under `frame/.runtime/checks/bottom-bar/` were inspected. OS picker
interaction, other codecs and a broad export/rotation suite were not rerun.
Previous normal frame PID **17072** closed normally. Updated normal frame PID
**4956**, with owned worker PID **7260**, was verified and left running.

## Baked feature blocks: Rotation

Rotation is one baked feature sub-parent containing its four controls. The
separator is a separate Action Bar sibling, outside the group's outline.
Rotation's UI and local interaction owner is:
`frame/view/window/action-bar/RotationControls.jsx`.

```text
Action Bar
├── RotationControls
│   ├── Rotate left
│   ├── Degree input
│   ├── Slider
│   └── Rotate right
└── ActionSeparator
```

One owning component contains the group's UI and local interactions, so editing
its slider/buttons/layout happens in one place. Action Bar discovers and places
one block; the block moves/resizes together. This is feature composition, not an
Action Bar-specific registry or another generic layout system. Reuse MUI and the
shared ActionButton renderer; keep calculations/history in their existing owners.
JSON still owns group placement, named internal parts, dimensions, spacing,
appearance and states. Separate UI/LOGIC sections remain.

Outline properties already exist: `colors.outline`, `geometry.outlineWidth`,
`geometry.outlineStyle` and `geometry.outlineOffset`, including state overrides
such as `focusVisible`. They apply to the baked group and its configured parts.
A border is the box edge; an outline is a separate ring and does not consume
layout space. Development inspector outlines remain separate and development-only.

The group has a normal-use 1px configured outline. Internal padding is 0.5% of
the group's width and 4% of its height; row gaps are 1.5% of content width.
It occupies 36% of Action Bar width and 92% of its height with
4% top/bottom placement insets; padded controls retain the compact bar sizing.
Its named parts share one injected session. Input autosizing remains local to the
group. Its row cell uses only the displayed text width; no blank growth area is
reserved. During pointer dragging, the preview/slider remain live while the
numeric field holds its display until release, keeping the track steady.
The separator has its own
`ActionSeparator.jsx` registration. Superseded independent rotation registrations
and parent preferred-width plumbing remain removed.

## Exact target files and ownership

Paths below are relative to `frame/`. This maps every skeleton file to its job;
it is not permission to fill every file before proving the first slice.

```text
frame/
├── config.json                         Window, sections, instances, presets, output settings
├── package.json                        Standalone package and declared commands/dependencies
├── vite.config.mjs                     Renderer build and automatic module catalog
├── start.cmd                           Start frame only
├── desktop/
│   ├── main.cjs                        Compose native app lifetime and services
│   ├── FrameWindow.cjs                 Create output window and bind narrow native window actions
│   ├── preload.cjs                     Narrow renderer-to-desktop bridge
│   ├── LayerReceiver.cjs               Accept/validate finished-layer and clear messages
│   ├── ImageWorker.cjs                 Worker requests, replies, errors and lifetime
│   ├── ImageFileDialogs.cjs            Native image dialogs and original-file protection
│   └── DiagnosticLog.cjs               Persist diagnostic records; tolerate logging failures
├── view/
│   ├── index.html                      Renderer entry document and security policy
│   ├── main.jsx                        Compose renderer lifetime/session and layout
│   ├── styles.css                      Reusable mechanics only
│   ├── preview/
│   │   └── PreviewPainter.mjs           Stable photo painter, independent of section placement
│   ├── layout/
│   │   ├── WindowLayout.jsx            Unified section/instance mounting; no named-control imports
│   │   ├── ComponentDiscovery.mjs      Catalog component exports and their source folders
│   │   ├── ConfigValidation.mjs        Resolve/validate configuration against complete catalog
│   │   ├── LayoutDiagnostics.mjs       Deduplicate, format, summarize and forward diagnostics
│   │   └── LayoutInspector.jsx         Development boundaries and ID/parent/source labels
│   └── window/
│       ├── windows-bar/
│       │   ├── AppIcon.jsx             Configured local app artwork
│       │   ├── FileName.jsx            Current filename and accessible full-path information
│       │   ├── ExportStatus.jsx        Saved/dirty/empty status presentation
│       │   ├── UndoButton.jsx          Invoke photo-history Undo
│       │   ├── RedoButton.jsx          Invoke photo-history Redo
│       │   ├── WindowActionButton.jsx  Configured minimize/maximize/restore/close behavior
│       │   └── InfoButton.jsx          Open information overlay
│       ├── action-bar/
│       │   ├── FileActionButton.jsx    Configured Load/Save behavior; delegates shared renderer
│       │   ├── SizeLabel.jsx           Accessible photo-size label
│       │   ├── DecreaseSizeButton.jsx  Invoke shared photo-size decrease
│       │   ├── PhotoSizeSlider.jsx     Size interaction and grouped edit completion
│       │   ├── IncreaseSizeButton.jsx  Invoke shared photo-size increase
│       │   ├── PhotoSizeValue.jsx      Show current photo-size percentage
│       │   ├── RotationControls.jsx    Baked rotation UI/interaction; outlined group and named parts
│       │   ├── ActionSeparator.jsx     Independent Action Bar separator outside feature outlines
│       │   ├── PlacementDropdown.jsx   Fit/Fill/Center action selection
│       │   └── ResetButton.jsx         Invoke shared photo reset
│       ├── frame-body/
│       │   ├── PhotoPreview.jsx        Canvas lifetime and interaction subscriptions
│       │   ├── PhotoPointerInput.mjs   Photo drag and inspection-pan gestures
│       │   ├── PhotoWheelInput.mjs     Frame-scoped wheel/modified-wheel interaction
│       │   └── DropTarget.jsx          Drop feedback and image-drop handoff
│       ├── bottom-bar/
│       │   └── FrameInfo.jsx           One expanding text outlet for operation messages and diagnostics
│       └── overlays/
│           └── information/
│               ├── InformationDialog.jsx Information/shortcut surface with configured parts
│               └── CloseButton.jsx    Close information overlay
├── logic/
│   ├── FrameSession.mjs                Coordinate session lifetime/subscriptions and UI state
│   ├── WindowActions.mjs               Renderer window actions, native state and subscriptions
│   ├── PhotoState.mjs                  Loaded photo/preview identity, output choice and saved key
│   ├── PhotoOperations.mjs             Shared sizing, rotation, placement and reset rules
│   ├── PhotoHistory.mjs                Current document and optional Undo/Redo tracking
│   ├── ViewState.mjs                   Inspection zoom/pan state
│   ├── ViewOperations.mjs              View-only zoom/pan/fit operations
│   ├── LayerState.mjs                  Accepted layer identity/revision and bitmap lifetime
│   ├── LayerMessages.mjs               Renderer layer-event handling; stale decode rejection
│   ├── ImageFileActions.mjs            Load/save coordination and accepted export snapshot
│   └── KeyboardShortcuts.mjs           Shortcuts with input/menu/modal isolation
└── image-worker/
    ├── Cargo.toml                      Independent image worker crate; no stamp-engine dependency
    └── src/
        ├── main.rs                     Worker entry and request/reply loop
        ├── protocol.rs                 Image/layer/export request and response contracts
        ├── session.rs                  Worker photo/layer lifetime and revision checks
        ├── photo.rs                    Decode/orient photo and apply photo transformations
        ├── layer.rs                    Validate/store received pixels; composite fixed layer
        └── export.rs                   Compose requested snapshot and encode output image
```

### Contract edges to preserve during implementation

- Discovery registers renderable component exports, not helpers. The active painter
  is `view/preview/PreviewPainter.mjs`, imported through a stable `@frame` alias.
  Moving PhotoPreview between parents does not move or rewrite its painter.
  Pending pointer/wheel helper skeletons must follow the same placement-independent
  dependency rule when implemented; they are not component registrations.
- Controls obtain the resolved instance config and shared session/actions through
  a consistent injected interface/context. Do not make a movable control depend
  on its parent ID, filename, or folder-specific relative import to shared logic.
- InformationDialog is a pending information surface, not a section-specific
  assembly registry. Its children follow the unified mechanism and configured
  relationships. Notifications use the text-only Bottom Bar, not an overlay.
  Former bottom-control/notice skeleton files remain untouched and unimplemented;
  they are no longer the Bottom Bar target. Future view/output controls need an
  approved location elsewhere before implementation.
- ConfigValidation owns structural matching and uses shared config/appearance
  mechanisms from `@APPS/components/` where they fit the contract. Do not create a
  competing palette/resolver. ComponentDiscovery gathers facts; WindowLayout
  mounts validated results; neither takes over validation or diagnostics policy.
- LayoutDiagnostics owns issue identity, deduplication, formatting and summaries.
  DiagnosticLog only persists its records. LayerReceiver validates external
  messages; LayerMessages handles renderer delivery/decode; LayerState owns the
  accepted revision. These are separate boundaries, not duplicated rule engines.
- FrameSession composes the state/operation owners; it must not grow into another
  monolithic controller containing their calculations or UI geometry.

The skeleton fits this file map; no additional skeleton confirmation is needed.
Supporting package files include `.npmrc`, `.gitignore`, `package-lock.json`, the
standalone worker's `Cargo.lock`, `desktop/build-worker.cjs` and focused checks in
`tests/`. Build/cache/session artifacts remain under frame. ConfigValidation owns the flat section/instance schema.
Frame uses the explicit `configuredAppearance` / `configuredSx` contract in shared
`components/appearance.mjs`, plus generic bounds/fill/icon mechanisms. Legacy
appearance exports remain only for the reference app, with their behavior unchanged;
frame does not call them. No output-frame source was modified or migrated.

`@APPS/components/ActionButton.jsx` is the single shared MUI action-button
renderer/icon library, not a section registration. FileActionButton and
WindowActionButton retain separate domain behavior/config validation in their
assigned section folders. Both delegate rendering to this one library component;
there is no duplicated button styling and no folder-parent validation exemption.
The consumer's Vite config resolves shared React/MUI/Emotion imports to frame's
declared dependencies, not an undeclared ancestor installation.

### Validated visual values and failure ownership

- Presets have explicit visiting/resolved/invalid resolution states. Cycles stop,
  emit `PRESET_CYCLE`, and invalidate only their dependents; no recursive retries.
- Explicit null groups, unknown preset properties, invalid values and invalid
  state patches are rejected. Preset inheritance is not a fallback for bad input.
- Borders and focus outlines read their styles/widths from JSON. Shadows are
  either `"none"` or structured `{x,y,blur,spread,color,inset}` values, with numeric
  dimensions and an explicit color; arbitrary CSS strings are not accepted.
- Transitions are explicit too: `"none"` (current default) or structured
  `{properties,durationMs,easing}`. The shared adapter overrides MUI's implicit
  transition so measurements and states do not depend on a hidden theme duration.
- Physical horizontal/vertical alignment maps according to row/column direction.
  Unsupported main/cross-axis combinations are diagnosed. Sections use the same
  configured state-style adapter as controls, including real hover styling.
- Sibling section overlap is diagnosed symmetrically; all overlapping section
  subtrees are skipped while unaffected sections remain. Touching edges are valid.
  Gaps are not automatically filled or reassigned.
- Inspector parts and bounds are validated explicitly. Diagnostics preserve exact
  property paths, instance/component/parent/source ownership, and section IDs where
  applicable. The UI shows a concise summary; complete records remain in the log.
- Components may export `configKeys` plus a pure `validateConfig` function for
  their own options. The generic mechanism validates only those declared additions
  and isolates hook failures. FileActionButton owns action/icon validation;
  PhotoPreview owns its inset options. Adding a control does not add its rules to
  the unified layout file.
- Available component validators run even when their instance/section is disabled.
  When an implementation is intentionally absent and disabled, validate identity,
  bounds and shared visuals, but keep its custom options opaque: there is no
  authoritative component schema to judge them. Enabling it requires the missing
  implementation; do not mislabel its options as unknown common fields.
- Startup `document` and `history` are separate config owners. Invalid history
  policy logs an issue and selects explicit no-tracking mode (`limit: null` in the
  document/history owner), not an invented limit or a blanket empty layout.
  The document, Load, preview, Save and read-only controls remain available.
  Invalid startup document is separately logged; Save stays disabled until Load
  supplies a valid photo document. No invalid transform is silently replaced.
- File actions accept an optional initiating-control context. Errors include
  operation, component/instance/parent IDs, source and config path. Calls with no
  UI origin name the actual logic owner instead of guessing a control instance.
- Instances may declare `interaction: {pointerEvents, dragRegion}`. Supported values
  are `auto | none` and `drag | no-drag | inherit`; invalid values are isolated and
  logged with the exact path. Generic slots apply those settings, with standard
  interactive/no-drag mechanics when omitted. Filename uses `none`/`inherit`;
  no component-name selectors, hidden z-index tricks or blocking hit-test box.
  The leaf filename component does not own window-drag logic.
- Optional `aspectRatio` fits a control inside its allocated bounds using its
  immediate parent axes, left anchored and vertically centered. Rotation buttons
  use ratio 1 and the exact shared ActionButton renderer/fileAction preset.
- Components declare `partKeys` and required configuration capabilities. Discovery
  gathers these facts; ConfigValidation resolves every named part and checks all
  declared capabilities before mounting. Invalid rotation settings isolate only
  dependent controls, not Load/Save/history/preview. Diagnostics retain exact paths.
- Positioned input/degree/slider-control parts require `bounds`. MUI-managed rail,
  track and thumb instead require parent-relative `size`. Rail/track span a 100%
  control range; MUI owns value-driven track fill and thumb position. Supplying an
  unused placement kind is rejected by the component rather than silently ignored.
- `active` and `error` join supported states. The input, degree label and slider
  managed parts receive their applicable focus/error/disabled/active state styles.
  The native input reset only inherits its configured owner's font/color/alignment;
  it does not introduce tuned dimensions, padding, colors or a competing theme.
- PhotoHistory owns live-edit grouping, cancellation and pending Undo availability.
  Typing finishes on Enter/blur; slider dragging finishes at pointer release and
  keyboard repeats at key release/blur. Escape restores the gesture's starting
  document; canceled pointer movement cannot restart it. Button edits, Undo/Redo,
  Load and Save settle pending edits through that same history owner.

## Structure contract

One unified layout mechanism creates configured sections across the window's
100% area. Section definitions hold ID, folder, bounds, colors and other visuals.
Sections are Windows bar, Action bar, Frame/body and Bottom bar. Windows area may
instead be reserved separately, leaving three content sections. Native-caption
mode respects its measured safe area. Current custom-caption mode
uses the full configured Windows Bar; no unused native control space is reserved.

Control folders are `windows-bar/`, `action-bar/`, `frame-body/`, `bottom-bar/`,
with owned overlay controls. Do not create per-section parent components with
manual child imports. A build-time catalog discovers files from those folders;
each section accepts only files from its assigned folder. Move a control's file
and change JSON parent/placement to relocate it; no assembly/behavior edits.

Every control source has UI and LOGIC sections when applicable:

- **UI:** rendering/config connection; JSON owns all application appearance.
- **LOGIC:** behavior, events and validation owned by the file. Shared math,
  history and operations have one shared owner, not copied into each control.

Local fixes touch one owner: JSON for intended visuals, control UI for broken
visual application, control LOGIC for local interaction, shared operation for
behavior common to several inputs. Empty skeleton files stay empty.

## Identity, enabling, discovery and mounting

- Each file exports one stable **component ID**, independent of its filename.
- Each JSON instance has a stable **instance ID**, component ID, `parentId`,
  `enabled`, placement and resolved visuals. Distinguish implementation identity
  from instance identity so Load and Save can use the same FileActionButton.
- Discover and validate the complete catalog before mounting valid results.
  Identify all duplicates; never mount whichever duplicate happens to be first.
- `enabled: false` means intentionally unmounted, not missing. It is distinct
  from a busy/disabled button. Still report invalid config and ID conflicts.
- One mechanism owns both stages. Do not add a registration service or manually
  maintained file map that must change when a control moves.

## Configuration and diagnostics

JSON nodes/presets own colors and states, position, dimensions, padding, gaps,
alignment, typography, icons, borders and shadows. Parent-relative percentages
have explicit axes, including portal surfaces. CSS/shared adapters only apply
mechanics/config. No app theme or independent visual authority.

Folder/parent disagreement, missing enabled files/config, unknown parent,
duplicate IDs or invalid visuals are logged and isolated, not thrown through the
whole app. Skip the affected control or invalid section subtree; valid parts keep
running. No guessed parent, silent corrections or hardcoded visual substitutes.

Persist structured diagnostics and show readable non-blocking summaries in the
Bottom Bar, never as toast/floating banners. Include
issue code, component/instance ID, file/config paths, expected and actual values,
action taken, timestamps and repeat count. Deduplicate identical issues per run.
For example: `undo: found in windows-bar/, config assigns actionBar; skipped`.
Logging itself must not crash the app.

Development-only inspection mode draws section boundaries and labels component
ID, instance ID, `parentId` and source file. Off during normal use; it must not
block interaction. Its appearance also comes from config. Keep it a small part of
the unified layout mechanism rather than another framework.

## Standalone output

`frame/` runs without engine/input. It owns window/output settings, photo editing,
preview and Rust image export. It listens for a finished transparent layer with
dimensions/revision or a clear message. It never imports, builds, starts or calls
engine/input, accepts stamp-generation settings, or decides stamp content.

Photo transforms leave stamp placement unchanged. View transforms affect only
inspection. Preview and export use the same accepted layer revision. Late decode
cannot restore an older/cleared layer. Replacing the photo preserves the layer.
Preserve original-file protection, photo replacement, shortcuts, history, notices,
black output and 1200×1600 / 2400×3200 / 3024×4032 export sizes.

## Current file-slice ownership

| Owner | Implemented responsibility |
| --- | --- |
| `FileActionButton.jsx` | One file-behavior registration, two instances, component-owned action/icon validation and delegation to the shared MUI renderer. |
| `components/ActionButton.jsx` (under `@APPS`) | One rendering/icon mechanism shared by file and window action registrations; no native/file behavior or app-specific appearance. |
| `WindowActionButton.jsx` / `WindowActions.mjs` / `FrameWindow.cjs` | Config-driven window-button behavior, renderer event subscription and whitelisted native window operations; normal close/worker cleanup. |
| `ImageFileActions.mjs` | Busy/cancel/error/save sequencing; coordinates state/history through their methods. |
| `PhotoState.mjs` / `PhotoHistory.mjs` / `PhotoOperations.mjs` | Photo/preview identity and saved state; document with optional history/reset; centered-fill and export-transform rules. |
| `ImageFileDialogs.cjs` | Native dialogs, supported export selection, identity checks and protection of every successfully loaded original. |
| `ImageWorker.cjs` | Persistent local process, attributed NDJSON replies, operation failures and shutdown. |
| `image-worker/src/` | Standalone protocol/session, oriented decode, full-resolution photo rendering, matte and PNG/JPEG encoding. No engine/input dependency. |
| `PhotoPreview.jsx` / `view/preview/PreviewPainter.mjs` | Relocatable configured canvas, stable feature helper, preview lifetime and drawing of the published transform. |
| `FileName.jsx` / `FrameInfo.jsx` | Read-only filename and operation status presentation. |

`output-frame/` remains unchanged and is only a reference. Frame implementation
uses its own declared owners; no old controller or stamp runtime was copied in.

## Delivery sequence

1. **Complete:** create the empty `frame/` skeleton. Use the file/ownership map
   above as the comparison baseline; leave other app code untouched.
2. **Complete for the first slice:** configured native window/section containers,
   discovery, validation, persistent diagnostics, inspector and real Undo/Redo.
   Physical relocation/filename rename, config consumption, enabling, history and
   mismatch isolation passed. Controls are restored to Action Bar after the proof.
   The five demonstrated audit defects are repaired; targeted bad-config checks
   confirm isolation/logging instead of crashes or silent fallback.
3. **File slice complete:** one shared FileActionButton and preset, two instances,
   native Load/Save, real preview and independent Rust photo/black PNG/JPEG export.
   Shared-preset changes, per-instance isolation, enabling, mismatch logging,
   cancellation, replacement and original protection are verified.
   The relocation test arrangement is retained: Load/Save in Action Bar and
   Undo/Redo in Windows Bar. Custom minimize/maximize/restore/X use the common
   renderer, and X completes the normal worker/session cleanup path.
4. **Rotation complete:** input/degree parts and states are proven against real
    photo transforms. Next: remaining controls, view gestures and layer receiving.
   Implement from the contract; remove superseded paths within the authorized
   target instead of accumulating alternate implementations.
5. Verify affected behavior/native sizes with focused checks, then restart and
   leave the updated target app running. Report actual evidence.
6. Reuse the proven UI mechanism in `ui-control`; apply ownership, not the UI
   schema, to the headless engine pipeline. Joint launch/routing remains outside
   frame. Do not implement the engine first merely to make output imports resolve.

### When a check fails

Stop the failing change and inspect the producing owner plus affected consumers
in the map. Record the requirement, actual behavior, ownership/config gap and
structural correction in this document in place. Correct the owning representation
or boundary, then run the focused proof for that change. Do not apply downstream
CSS overrides, silent defaults or special cases to conceal the gap. Do not
re-audit unrelated files or repeatedly reconfirm an already-correct skeleton.

## Acceptance checklist

- [x] Stable component identity survives filename rename (Undo renamed during relocation proof).
- [x] Multiple instances share one component/preset correctly, including Load/Save.
- [x] Discovery and validation precede mounting; duplicate component/instance IDs are isolated in contract checks.
- [x] Disabling an instance in JSON hides it without a false missing-instance log.
- [x] Undo's actual button color/height follow JSON and Redo remains unchanged.
- [x] Rotation color/height changes JSON only and affects the actual field; number
      and degree symbol remain aligned, while implemented Load/Save stay unchanged.
      Reset/Placement remain empty skeletons, so their visual independence is not claimed.
- [x] Resizing the Action Bar changes child height by its configured percentage and leaves Bottom Bar unchanged.
- [x] Moving Undo/Redo between folders plus JSON relocates them with no parent code
      or behavior edits; current physical files/parent IDs place them in Windows Bar.
- [x] Load/Save are physically registered in Action Bar; custom X is in Windows Bar
      and uses the same shared renderer/preset without weakening folder guards.
- [x] Custom minimize, maximize/restore (including icon change), and normal-close
      cleanup work with the native control overlay absent.
- [x] Intentional folder/parent mismatch logs a readable, deduplicated record and
      leaves valid controls usable; inspect repeat counts and persisted records.
- [x] Inspection mode displays boundaries/IDs/source and is absent in normal mode; summary is readable at both sizes.
- [ ] No independent theme, palette, tuned CSS, ignored config or visual fallback.
- [x] Standalone photo/black PNG/JPEG exports work without either producer module present.
- [ ] A test sender can set/clear a layer; photo movement and replacement preserve
      independent layer placement, and export uses the accepted revision.
- [ ] Native default/minimum screenshots include caption areas, overlays and long
      text; action bar stays on one row, Bottom Bar remains text-only, no redundant title/VIEW.
- [x] Bottom Bar defaults to one line with 1% top/bottom padding, expands/shrinks
      for multiline messages, preserves preview space, and replaces diagnostic banners.

## Retained engine/input requirements for later work

Input supplies locale, date/time, manual address, coordinates, company/person,
weather, altitude, compass, code, template and supported frame choices. Engine owns
normalization, optional-field omission, code generation, verified locale/branding
selection, address formatting/wrapping and prepared stamp layout. Lookup provider
selection is separate from manual input and text wrapping. Measure text with the
actual font; preserve explicit newlines. Do not invent unsupported speed consumers.

Preserve the accepted template-34 3:4 shield/photo-code placement. The Indonesian
example establishes `Kode Foto`, `02 November 2026`, `Senin`, top-right branding,
right-side verification and a three-line address in that example; it does not
prove language alone selects branding, or a universal three-line limit. Complete
original locale/template/provider mappings remain unverified. Keep recovered
facts, rebuilt logic and calibration distinguishable. Preview/export share one
prepared stamp definition, with an independently usable headless engine.

## Verification status

- `npm.cmd run test:contract`: **24/24 passed**. Covers valid resolution, empty/helper
  exclusion, relocation matching, duplicates, enabling, config isolation, missing
  nodes/parents/visuals, real history and deduplicated diagnostics/write failure.
  Seven added regression cases first reproduced the confirmed failures and then
  passed: direct/indirect cycles, null/invalid shadows, unsupported preset keys,
  symmetric section overlap, inspector failures, exact owner/property diagnostics,
  and column/border mapping.
  The current suite also checks a component-owned options contract across two
  instances and photo-history reset. History-specific fixtures explicitly exclude
  other control types; real file controls are checked separately in Electron.
  Current regressions also verify untracked document/file operation with invalid
  history, disabled option-validation order and absent implementations, and file
  failure origin metadata. The document is no longer stored in `history.initial`.
  Native-window state publication/action failures and explicit caption-mode schema
  are included, as is the generic validated interaction contract. Tests/reference
  paths follow the current swapped arrangement.
- `npm.cmd run build`: **passed**, with frame-owned installed dependencies and no
  imports/build hooks to engine, input or existing output app.
- `npm.cmd run test:layout`: **passed** in real Electron. Checked actual MUI
  appearance, sibling isolation, parent percentages, enabling, persisted repeat
  counts and usable Redo despite mismatched Undo. Moved both source files to Windows
  Bar and renamed Undo, changed only JSON, rebuilt changed inputs and verified
  history and caption safe area at 960×960 and 760×700. Finally restored original
  source/config and their matching build; no control behavior or assembly edits.
- Visual review found the inspector's full source labels did not fit small control
  outlines. Compared inspector/config/mounting ownership; kept short local badges
  and moved full identities/source paths to its config-sized summary.
  Final build plus `npm.cmd run test:inspection`: **passed**. Readable unclipped
  summary and native screenshots inspected at both sizes. Other passing behavior
  checks were not rerun for this inspector-only correction.
- Current native inspection images: `frame/.runtime/checks/slice-inspection-default-native.png`
  and `slice-inspection-minimum-native.png`. Relocated normal-mode images are
  `slice-relocated-default-normal-native.png` and `slice-relocated-minimum-normal-native.png`.
- Diagnostics persist as deduplicated per-run snapshots under `frame/.runtime/logs/`.
  Normal mode exposes no developer proof interface. Test windows close after checks;
  the updated normal app is launched separately for the user.
- `npm.cmd run test:guardrails`: **passed** in Electron on the final build. All
  five fixes were exercised in the renderer, including usable Redo while Undo's
  preset is cyclic, invalid visuals, isolated overlapping sections, exact persisted
  paths/ownership, configured column alignment, dashed borders, structured shadows
  and actual section hover. The diagnostic summary fits at both window sizes.
  Native `guardrails-default-native.png` / `guardrails-minimum-native.png` in
  `.runtime/checks/` were inspected. Their issue count comes from deliberate invalid
  test configurations, not startup defects. The test restores the valid config in
  memory and closes the window; it does not change source/config files.
- `npm.cmd run test:image`: **2/2 passed** for black output, identity/alpha photo
  rendering and invalid transform/resolution rejection.
- `npm.cmd run test:files`: **passed** with real Electron and the standalone Rust
  worker. Verified native-dialog command paths using controlled selections, live
  photo pixels, black-frame PNG, photo PNG/JPEG, all three exact 3:4 output sizes,
  cancel/replace flows, unchanged source hashes, protection of an earlier original
  after replacement, common preset and per-instance styling, enabling and parent/
  action mismatch isolation. Actual OS picker interaction remains a manual path.
  Native `frame/.runtime/checks/files/files-default-native.png` and
  `files-minimum-native.png` were inspected. Their diagnostic summary records
  deliberate invalid test inputs. No such inputs are written to startup config.
- Final `npm.cmd run build` **passed**. The expanded inspector also passed
  `npm.cmd run test:inspection` at both sizes; its configured summary was sized for
  the current instances. No full old-app suite was run for this slice.
- Completion restart **verified**: the previous normal frame instance was closed,
  then the updated normal `TimeMaxx Frame` window and its owned Rust worker were
  launched and confirmed alive. The normal app was left open for the user.
- `npm.cmd run test:review-fixes`: **passed**. A separate Electron instance started
  with invalid history and preserved all seven controls. Real black/photo exports
  and live preview worked without Undo/Redo tracking. PhotoPreview was physically
  moved/renamed to a new configured parent with only file placement/JSON changes;
  source imports and behavior were unchanged. Native source-overwrite rejection
  logged the actual Save instance/operation/config/source; disabled malformed
  options were logged. Default/minimum native screenshots were inspected under
  `.runtime/checks/review-fixes/`. The proof restored the component and its matching
  production UI build. Its invalid fixture config never replaces startup config.
- `npm.cmd run test:window-swap`: **passed**. Confirmed actual folder/parent swap,
  real Load/Save and Undo/Redo after the move, one renderer/preset across different
  parents, centered equal neutral Load/Save/X styling and in-bounds default/minimum
  placement. Native overlay was absent. Native minimize/maximize/restore and icon
  updates worked; unsupported native methods were rejected. Clicking custom X
  exited with code zero and removed the owned session directory after worker
  shutdown. Native `window-swap/swapped-default-native.png` and
  `swapped-minimum-native.png` were inspected under `.runtime/checks/`.
  Final `build:ui` and the expanded `test:inspection` passed; inspection summary
  fits all ten instances. Earlier full file/guardrail/relocation scripts had their
  location-dependent expectations updated but were not rerun unnecessarily.
- `npm.cmd run test:bar-layout`: **passed** on the final UI build. Verified left
  Undo/Redo, filename ordering/alignment/transparency/pass-through, right-aligned
  equal 8%-wide Load/Save boxes, centered icons and equal Windows Bar button boxes
  at 960×960 and 760×700, including compact equal-height parent rows and symmetric
  proportional vertical padding. Native screenshots `bar-layout/bars-default-native.png`
  and `bars-minimum-native.png` under `.runtime/checks/` were inspected.
  A DPI-aware native Windows pointer helper, restricted to the proof window's
  verified foreground HWND, dragged over displayed filename text and moved the
  actual window (65×33 physical pixels). Native Undo/Redo clicks changed history
  with zero window movement. Cursor position was restored and the proof app closed.
  No Rust/image-export suite was rerun for this layout-only change.

### Rotation completion and second review

- Changes are limited to `frame/`, shared `components/ActionButton.jsx` /
  `appearance.mjs`, and this note. Four existing control skeletons were implemented;
  `ActionSeparator.jsx`, `tests/rotation.test.mjs` and `tests/rotation-proof.mjs` were
  added. Discovery remains automatic; no section registry, engine/input dependency,
  source protection bypass or reference-app migration was added.
- `node --test tests/contract.test.mjs tests/rotation.test.mjs`: **30/30 passed**.
  Includes malformed discovery contracts, exact-path part/ratio/policy isolation,
  decimal/wrap rules, pending-edit Undo, canceled redo preservation, no-op gestures,
  button/edit ordering, reset, Save settlement and explicit untracked editing.
- `npm.cmd run test:rotation`: **passed**, including five focused logic cases and
  real Electron/Rust verification. Checked 0.1° field synchronization, ±90° buttons,
  Enter/blur/invalid drafts/Escape, live slider dragging and one-step Undo/Redo,
  whole-drag cancellation, actual named-part error/disabled/active styles, changed
  preview and PNG export pixels, exact 1200×1600 output, unchanged source hash,
  JSON-only field height/color with Load unaffected, actual proportional slider-part
  sizes, true square buttons at both sizes and centerline at 760×1100.
  Invalid part fixtures were isolated and persisted with source/path/repeat counts.
  Their config never replaces startup config. Native screenshots are under
  `frame/.runtime/checks/rotation/`; default/minimum captures were visually inspected.
- Second review compared producing owners and actual consumers, not the empty
  skeleton or unrelated applications. Confirmed and fixed:
  - **Medium — input state routing:** error existed on the native input but not
    the MUI visual owner, and a later full focus style hid the error color.
    `RotationInput.jsx` now routes error to InputBase and preserves state priority.
    The actual color regression failed before the correction and passes now.
  - **Medium — canceled drag continuation:** Escape restored history, but remaining
    pointer movement opened a new edit. `RotationSlider.jsx` now owns only gesture
    acceptance/cancellation; history still owns the document and rollback. The
    move-after-Escape regression failed before and passes after the correction.
  - **Medium — width-limited square alignment:** in a tall window, fitting the ratio
    shortened the square without adjusting its top. `configuredBounds` now centers
    the fitted height inside its allocation. The 760×1100 regression failed before
    the correction and passes afterward; normal/minimum bounds remain aligned.
  - **Medium — ignored part placement:** generic validation allowed a bounds/size
    combination the control did not consume. Component validators now enforce their
    positioned vs MUI-managed contract; the real renderer isolates/reports the
    unsupported thumb bounds. Applicable disabled states reach the degree/rail/track.
  - **Low — misleading export diagnostics:** malformed part/requirement declarations
    reported custom config keys instead of the bad export. Discovery now names the
    actual export/value and rejects nonfunction validators before mount. Focused
    discovery regressions verify isolation and source attribution.
- Final UI build, `test:inspection` and `test:bar-layout`: **passed**. The inspector
  summary fits all fifteen active instances at default/minimum sizes; native
  inspection captures were read. Native filename dragging and history clicks still
  work without window movement during clicks. No unrelated/full suite was run.
- Review verdict: **PASS for the delivered Rotation slice**. Automated controls use
  real Electron, OS window captures and the real local Rust exporter; dialog choices
  are controlled test selections. Physical touch/assistive-technology interaction
  and future Reset/Placement/layer behavior are not claimed as tested.
- Completion restart verified: stale normal frame PID **8632** closed normally and
  its owned worker exited. Updated normal `TimeMaxx Frame` PID **13860** and owned
  worker PID **19164** were confirmed alive and left running. No proof/inspection
  flags or fixture config were used for that launch.

### Compact Rotation field

- JSON-only visual adjustment: degree box width reduced from 9% to 6.5% of
  Action Bar (about 28% narrower). Named input/degree parts use tighter proportions
  and 13px configured text; slider, right rotation button and separator move 2.5%
  left. Heights, square-button behavior and right Load/Save remain unchanged.
- `node tests/rotation-proof.mjs`: **passed**. Added actual font-width checks for
  `-180`, `180`, `179.9` and `-179.9` at default/minimum sizes, plus a compact-width
  regression. Three whole-number digits still allow the sign and 0.1° precision.
  Native default/minimum captures under `.runtime/checks/rotation/` were inspected.
- Focused review found no additional defect. No component logic, shared styling
  or worker source changed; runtime JSON needs no renderer/worker rebuild.
- Relaunch verified: prior normal frame PID **13860** closed normally; updated
  normal frame PID **12688** and owned worker PID **14848** are alive and left open.

### One-digit default with automatic expansion

- RotationInput measures its displayed text with its configured font. JSON sets
  one digit minimum, six characters maximum, character-relative padding/gap and
  the existing 6.5% maximum allocation. Named input/degree parts retain configured
  appearance and height. WindowLayout only accepts the control's preferred width;
  photo math/history and other controls do not change.
- Removed the attempted sibling-follow layout after it moved the slider during
  dragging. The slider keeps a stable drag area; only the degree box autosizes.
  No anchor/dependency planner or additional layout system remains.
- Final UI build and quick real-Electron visual check completed. `0 → -179.9 → 0`
  measured `21 → 50 → 21` pixels at default size and `21 → 49.27 → 21` at minimum.
  The full negative angle fits; slider position stays unchanged. Saved native
  images in `.runtime/checks/degree-sizing/` were inspected.
- At the user's direction, no further regression-suite runs were made after this
  correction. Existing proof/fixture expectations were kept compatible with the
  new sizing configuration; they are not reported as newly rerun/passing.
- After the server restart, no old target main process was found. Updated normal
  frame PID **8920** and its owned worker PID **8564** were verified and left open.

### Baked Rotation block with outline and proportional padding

- `RotationControls.jsx` replaces the five separate rotation/separator registrations.
  One discovered instance owns the local UI/events and eleven configured parts;
  Action Bar only places the block. Shared ActionButton, PhotoOperations and
  PhotoHistory remain the rendering/math/history owners. Superseded preferred-width
  plumbing was removed from WindowLayout; part aspect ratios use the shared bounds
  mechanism. Existing proof/fixture selectors were updated for the single block.
- UI build and a quick focused-window Electron check completed. The right button
  changed 12.3° to 102.3°, Undo returned to 12.3°, and slider dragging reached 90°.
  Default/minimum native captures in `.runtime/checks/baked-rotation/` were read.
  There was one group registration and no startup diagnostics. Its 1px outline
  remained visible; buttons were true squares and the full `-179.9` text fit.
- Actual padding scales with the group: default width 421.52px gives 8.43px side
  padding and height 42.31px gives 1.69px vertical padding. Minimum width 333.52px
  gives 6.67px sides; height 30.36px gives 1.21px vertical padding. These are JSON's
  2%/4% values, not tuned pixel overrides. Field width still grows from 21px to
  50px while the slider keeps its fixed drag area. Load/Save placement is unchanged.
- Producing UI/config owners and affected consumers were reviewed. No additional
  framework, theme, controller or producer dependency was added. No broad contract,
  export or old-app suite was rerun for this UI consolidation.
- No old normal target process was found at completion. Updated normal frame PID
  **13472** and its owned worker PID **14968** were verified and left running.

### Compact proportional spacing and external separator

- Corrected the feature boundary: the baked block contains Left / Degree / Slider /
  Right only. `rotationSeparator` is an independent Action Bar instance outside
  the outline, rendered by `ActionSeparator.jsx`.
- Group width decreased from 44% to 36% of Action Bar (about 18% narrower).
  Horizontal padding is now 0.5% instead of 2%; vertical padding stays 4%.
  Four parts use a local non-wrapping row with 1.5% proportional gaps rather than
  fixed x positions. The field centres its expanding box inside a small,
  font-sized editing cell; the slider fills remaining space without moving during
  input changes. No parent layout/dependency framework was added.
- UI build and quick default/minimum visual check completed; no startup issues.
  Side padding measured 1.72px / 1.36px. At `0°`, field-to-rail spacing is now
  28.38px / 25.92px rather than the prior large positional gap (about 60px at
  default size). Full `-179.9` fits, buttons remain square, and the separator
  sits 1% of Action Bar width beyond the group. Slider dragging reached 90°.
- Visual inspection also caught endpoint thumb clipping after reducing the old
  slider inset. The slider now declares visible overflow and a compact 3% inset,
  preserving its whole thumb/focus ring without enlarging the group. Updated
  native captures under `.runtime/checks/compact-rotation/` were inspected.
  Existing proof expectations were adapted; no broad suite was run.
- No old target main process matched at completion. Updated normal frame PID
  **10940**, with owned worker PID **15480**, was verified and left running.

### Remove the remaining degree-field reservation

- Removed the fixed maximum-width field cell. Its width now equals the actual
  displayed box (21px at `0°`, 50px at `-179.9`). The slider takes the freed space.
  Only the existing 1.5% row gap remains between the left button and field.
- To avoid moving the track during pointer dragging, the numeric field is
  temporarily read-only and holds its display until release. Slider/preview values
  stay live; release, cancellation or window blur refreshes the numeric display.
  Typing and keyboard slider changes still resize normally. This stays inside
  RotationControls; no pointer-coordinate replacement or new math owner was added.
- UI build and quick visual/interaction check completed at both sizes. At `0°`,
  left-to-field gaps are 5.11px / 4.05px, and field-to-rail gaps are 11.92px / 9.47px.
  Full negative text fits; the separator remains outside. Dragging reached 90°,
  refreshed the field on release, and Undo restored 0°. Native images under
  `.runtime/checks/actual-width-rotation/` were inspected. No broad suite was run.
- Existing proof expectations now reflect actual-width reflow and use explicit
  element order rather than relying on CSS selector/document ordering.
- Previous normal frame PID **14824** closed normally. Updated frame PID **17072**
  and owned worker PID **5732** were verified and left running.

This proves layout/history, Load/Save and Rotation slices, not full application readiness.
Other editing controls, view gestures, full overlays, nested
outlet mounting and finished-layer receiving/composition remain pending.
The image worker does not generate stamps; the empty layer owner is not activated.
Exports currently use the configured default resolution; the full export selector
is not implemented yet. Rust image codecs support additional declared input formats,
but this slice's end-to-end fixtures verify PNG and JPEG paths, not every codec or EXIF variant.
Future controls must follow the same exported-ID and config interface; do not
claim that unused config fields/parts or every future library state are already proven.
