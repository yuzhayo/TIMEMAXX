# Current frame concept and delivery plan

## Current source audit — November 21, 2026

**Verdict: PARTIAL — the ownership structure is useful, but the implementation
does not yet satisfy all of the appearance, reuse and gesture-lifetime rules.**
This audit covers source at `0f54aa8ad8a2edc51b7d78c29d75b3618b29bcb0`.
During the audit only this Markdown file was changed. No application edits, builds,
tests, app restarts, commits or pushes were performed for that audit. Previous PASS claims
and screenshots later in this file are historical evidence, not validation of
the audited revision. Source line references below refer to application files at
that revision; Markdown line numbers will move as this report is maintained.

### Governing decisions and documentation conflicts

The decisions below are reflected in `AGENTS.md` and the current target sections
after repair A01. They remain authoritative over historical implementation notes
and test assumptions. The source audit is a snapshot, not a claim that subsequent
repairs have already resolved the remaining findings.

- Both Windows Bar and Action Bar are **4% high**. Active controls in Action Bar
  use equal parent-relative height. Square buttons are no longer a requirement
  for these rows; the latest request explicitly allowed different widths.
- Rotation and Size use one reusable adjustment sub-parent. The entire visible
  value control opens the popup; Rotation remains editable. Preserve these
  decisions rather than restoring the old degree-symbol-only trigger.
- File buttons are **Load / Reset / Save**. Startup and vertical maximize use the
  approved narrow, full-work-height, right-aligned shape; restore returns to prior
  bounds. Taskbar artwork is not an app-layout control.
- Only **Ctrl+S Save and Ctrl+Z Undo** were approved as application shortcuts.
  Existing configured wheel modifiers/Space-panning are separate preview inputs.
- Info is deferred; its eventual **button belongs before Bottom Bar text**, not
  in Windows Bar. The current text-only Bottom Bar is not a missing-feature bug.
- Future overlay workflow belongs to Input/engine and a **background
  orchestrator**. Composition/revision coordination belongs to that orchestrator;
  it creates no extra display. Frame remains the single photo surface and may
  display a finished combined preview without interpreting stamp settings.
  This integration is deferred. Empty Frame layer skeletons are not permission
  to implement the superseded Frame-owned composition design.

### Read coverage and section/component ownership

Read all nonempty files under `components/`, `frame/view/`, `frame/logic/`,
`frame/desktop/` and `frame/image-worker/src/`, plus `frame/config.json`,
`frame/vite.config.mjs`, the governing instructions and existing plan. Checked
zero-byte skeletons by file inventory. There are four configured sections,
15 instances, and 14 enabled instances. Tests were inspected selectively for
claims affected by the current schemas; no test suite was executed. Installed
MUI source was consulted for disabled-state and Slider event behavior.

| Area / file | Actual owner and audit result |
| --- | --- |
| Windows Bar | JSON row layout owns sibling order/gap; native window operations are outside JSX. Placement's text/indicator/menu state routing is repaired in A08. Four-percent height and right-lane Placement/maximize/X are unchanged. |
| Action Bar | Parent JSON owns shared vertical allocations and external gaps; baked row mechanics/order are shared. A08 value text/editor states now reach the visible content. Default geometry is unchanged. |
| Frame/body | Remaining-height section contains preview plus non-intercepting DropTarget. A10 prepares/decodes previews before replacement; painter/input/operations remain separate owners. A11–A13 retain input/busy/diagnostic gaps. |
| Bottom Bar | `FrameInfo.jsx` is the only live status outlet, with intrinsic wrapping height and percentage-padding calculation. No toast stack exists. Finding A13 concerns diagnostic attribution/summary, not the presence of this owner. |
| Overlays | All Information/notices JSX files are empty; no active overlay implementation or hand-built child registry exists. Info placement and deferred orchestration must follow the latest decisions above. |
| `ActionButton.jsx` | A02 repaired: common icon/text/editable-host renderer for file buttons, window actions, adjustment buttons/values and Undo/Redo. History icons are configured through JSON. |
| `AdjustmentControls.jsx` | Token-owned slider edits/cleanup remain here; row mechanics delegate to ConfiguredRow. Text/input/unit explicitly share the value part's appearance, including native text fill, fonts and alignment. Editor callbacks stay feature-owned. |
| `ConfiguredRow.jsx` | A07 shared owner for JSON part order, parent-relative slots/gaps and row alignment. Validates complete unique order, width/gap containment and non-wrapping row states for File/Rotation/Size. No feature actions or registry. |
| `ConfiguredPopover.jsx` | Shared validated geometry/placement plus reasoned Escape/outside dismissal. Edit settlement is delegated to its content owner; it does not manipulate history. |
| `appearance.mjs` | Existing config resolution/translation is unchanged. ConfiguredContent adapts its output to actual hosts/slots without a second palette or resolver. Legacy/reference callers are unchanged. |
| `ConfiguredContent.mjs` | A08 shared text resets, host/slot state routing and intrinsic font-relative spacing validation. Focus matching preserves shared state order. No feature behavior or registered control. |
| `config.cjs`, `controls.jsx`, `NodeContext.jsx` | Legacy/reference configuration and controls; read in full and checked for Frame consumers. No active Frame imports were found. Keep reference callers intact; their existence alone is not a Frame defect. |
| `FileControls.jsx` | Owns named file parts, provenance and actions; shared ConfiguredRow renders their JSON order and validates containment. Default remains Load/Reset/Save. |
| `SizeControls.jsx` | Thin value/operation adapter, passing edit handles through the same history owner as canvas inputs. No local slider handlers or history calculations. |
| `RotationControls.jsx` | A06 repaired: owned typing and arrow-step phases are distinct; held arrows finish on final matching key release. Enter/blur/Escape and token isolation are preserved. Existing DOM-name mapping is unchanged. |
| `ActionSeparator.jsx` | Renders configured separator only. Sibling placement is no longer calculated in this component; this boundary fits. |
| `UndoButton.jsx`, `RedoButton.jsx` | A02 repaired: thin session adapters using shared ActionButton with validated JSON icons. Their disabled state still ignores busy: A12. |
| `FileName.jsx` | Read-only filename/path presentation. JSON slot has pointer pass-through and inherited drag region. No file-operation or window-drag rules are copied into the leaf; this fits. |
| `PlacementDropdown.jsx` | A08 repaired: separate menu/list/item/indicator parts, explicit shared arrow ID, parent-relative indicator bounds and configured label/slot states. Owns options/commands only; placement math is unchanged. |
| `WindowActionButton.jsx` | Uses shared icon button and native operation adapter; respects separate vertical-maximized state. No photo logic in window controls; this fits. |
| `PhotoPreview.jsx` | Composes painter and input helpers through stable `@frame` aliases. No section registry or photo math; event-policy gaps are described in A11. Invalid input config currently isolates the whole preview instance, consistent with the current component-level validator boundary; finer isolation would be a separate decision. |
| `PhotoPointerInput.mjs` | Owns pointer capture/cancellation and calls photo/view operations. Uses painter geometry and edit tokens. Editing/modal gate is incomplete: A11. |
| `PhotoWheelInput.mjs` | Owns configured modifiers, delta conversion and idle grouping; calls operations. Boundary checks are canvas/frame scoped. Editing/modal gate and late response coordination still need review per A11. |
| `DropTarget.jsx` | Explicit file-drop-only handlers; no click loader. Feedback is pointer-transparent. Load/drop share the repaired A10 transaction; this control has no separate decoder or acceptance policy. |
| `FrameInfo.jsx` | Owns text measurement/padding, not file operations or record persistence. It imports the diagnostic formatter and shows both message and summary. Readability/ownership limitations: A13. |
| `ComponentDiscovery.mjs` | Collects full catalog and stable exports before mounting; now validates component-declared per-part option keys without a named-control registry. Empty skeletons/helpers remain excluded. |
| `ConfigValidation.mjs` | A09 repaired: validates explicit section mode, vertical footprints and intrinsic composition, then plans tracks after isolation. Named child allocations, presets, duplicate/folder isolation and sibling x placement remain here. |
| `WindowLayout.jsx` | One generic mount owner, error boundaries and inspector composition; no named feature imports. Consumes validated section mode/tracks and child bounds instead of inferring flow from surviving sections. |
| `LayoutDiagnostics.mjs`, `DiagnosticLog.cjs` | One renderer record/dedup owner plus native persistence adapter is correct. Some callers bypass the complete provenance and human-readable summary contract: A13. |
| `LayoutInspector.jsx` | Development-only non-intercepting badges plus global identity summary. No separate inspector framework. No new defect established in source. |
| `view/main.jsx` | Composition/bootstrap and shortcut attachment. Development reconfigure changes the layout plan but leaves session policies from initial startup; treat it as visual reconfiguration, not proof that all runtime policy edits apply. |
| `styles.css`, `index.html`, `vite.config.mjs` | Resets, drag/pointer mechanics, CSP and build-time aliases/catalog support. No section-specific assembly registry or engine/input import found. |
| `FrameSession.mjs` | Connects independent state/action owners; derived percentage projection is not duplicated size math. No monolithic UI controller. |
| `PhotoOperations.mjs`, `PhotoHistory.mjs` | Continuous updates/completions use the existing history token owner and feature math stays centralized. A06 field completion is repaired in its adapter; A12 discrete-step busy guard remains open. |
| `ViewState.mjs`, `ViewOperations.mjs` | Inspection state is separate from photo document/history and is not sent to exporter. No copied photo math; preserve this separation. |
| `PhotoState.mjs`, `ImageFileActions.mjs` | A10 repaired: PhotoState owns preview decode/URL resources outside plain published metadata; ImageFileActions owns ticket acceptance, history reset, rejection and completion sequencing for Load/drop. |
| `KeyboardShortcuts.mjs` | Only Ctrl+S/Ctrl+Z; delegates existing actions and excludes inputs/menus/popovers. This gate is more complete than preview inputs: A11. |
| `WindowActions.mjs` | Narrow transport and window-state owner, errors use origin metadata. No duplicated geometry; fits. |
| `FrameWindow.cjs`, `desktop/main.cjs` | Native startup, shared tall-bounds rule, taskbar identity and lifecycle belong here. The approved 934 width is native DIP, not a prohibited fixed-pixel control layout. Native double-click/full maximize remains available; no new defect is asserted merely for that retained OS operation. |
| `preload.cjs`, `ImageFileDialogs.cjs` | Narrow sender-checked Load/drop/ticket bridge. Native owner retains prior metadata/protected-source records until acceptance and reconciles uncertain completion by explicit renderer identity. |
| `ImageWorker.cjs`, `build-worker.cjs` | Frame-owned process/build boundary; photo load/accept/finalize/discard/export commands only. No producer-module launch/import. |
| Rust `main.rs`, `protocol.rs`, `session.rs`, `photo.rs`, `export.rs` | A10 bounded transaction retains old full-resolution pixels through acceptance/finalization. Decode/orientation and export math/encoding remain independent of UI; no engine/stamp/layer owner was added. |

### Findings, why they happened, and minimal fixes

All findings below are **Required** unless explicitly called deferred or
informational. "Confirmed source mismatch" means the conflicting code/config
was read; it does not claim a fresh GUI reproduction. Failure sequences not
exercised during this audit are labeled **code-derived risk**.

#### A01 — High at audit; documentation repair complete

- **Evidence at audit revision:** `AGENTS.md:134–145` and this file's former
  `Standalone output`/layer checklist assigned received-layer composition and
  revision handling to Frame. The former file map put Info in Windows Bar.
  Other paragraphs described a
  degree-only popup trigger, square controls, two Load/Save parts, and hidden
  Maximize. These conflict with the latest decisions summarized above and with
  `frame/config.json:57–116`.
- **Why:** feature/status notes were added while earlier target paragraphs and
  acceptance claims were not reconciled in place. The mixed document is being
  used both as a current specification and a historical implementation log.
- **Impact / fix:** future agents can implement the wrong owner or undo approved
  UI. Reconcile the existing agreement, target map and checklist to the latest
  user decisions; mark prior verification as historical. Do not implement Frame
  layer processing or move Info into Windows Bar. Keep orchestration deferred.
- **Status:** resolved as the first authorized repair. `AGENTS.md`, current target,
  file map, boundaries, delivery queue and checklist now reflect the latest user
  decisions. Old validation is explicitly historical. Application code, empty
  skeletons and test files were not changed for A01. A02 was subsequently repaired
  as recorded below. Subsequent repair status is maintained per finding.

#### A02 — Medium at audit; shared button rendering repair complete

- **Evidence at audit revision:** `components/ActionButton.jsx:28–34` owned the advertised common
  button renderer, but `components/AdjustmentControls.jsx:93–113` creates another
  MUI Button path for values. `UndoButton.jsx:2–4,14–16` and
  `RedoButton.jsx:2–4,14–16` each repeat MUI setup and directly import their icon;
  their JSON instances have no icon setting (`frame/config.json:63–64`).
- **Why:** the later value fix matched a preset/appearance, not the existing
  primitive implementation. Undo/Redo were left on their original rendering path.
- **Impact / fix:** common focus/disabled/rendering fixes need several edits, and
  Undo/Redo icons cannot follow JSON. Extend the existing shared button primitive
  with text/content and an editable-value host slot, preserving valid HTML and
  Rotation editing. Route the adapters through it; register Undo/Redo icons in
  the shared library and configure them. Do not move their behavior into it or
  put an input inside a native `<button>`.
- **Status:** repaired in the second piece. The existing `ActionButton.jsx` now
  renders icon/text content and an editable `div` host through one MUI Button
  path. AdjustmentControls delegates both value hosts to it; it no longer imports
  MUI Button. Undo/Redo delegate rendering and validate the `icon` from JSON
  against the shared registry. Their actions, the Rotation editor handlers,
  popup lifecycle and all bounds remain unchanged. No input is nested inside a
  native `<button>`.
- **Validation for A02:** UI build passed; source inspection found no direct MUI
  Button imports in active Frame JSX and no Undo/Redo icon imports in adapters.
  Native startup/minimum-size screenshots were inspected under
  `frame/.runtime/checks/shared-buttons/`. The normal app was returned to its
  original bounds and left running. No test suite or loaded-photo interaction
  check was run; A03/A05/A06/A08 are not closed by this rendering-only repair.

#### A03 — High at audit; percentage geometry repair complete

- **Evidence at audit revision:** `ConfigValidation.mjs:386–390` defines `parts.*.size` as immediate-
  parent percentages. `AdjustmentControls.jsx:84,161,171` instead appends `px` to
  slider height and rail/track/thumb dimensions. `parts.control.bounds` is required
  by the shared validator (`:32–34`) but rendering only calls
  `configuredSx(control)` (`:167`), which does not apply bounds. Slider size.width
  is accepted but replaced with `width: '100%'`. Current examples are in
  `frame/config.json:94–100,107–114`.
- **Why:** inline slider numbers were reinterpreted as popup pixel dimensions
  during extraction without changing the schema or implementing a portal base.
- **Impact / fix:** accepted JSON does not mean what it says; moving/resizing the
  parent does not scale those parts, and the configured 3% inset/94% width is dead.
  Establish an explicit popup/slider container with a defined proportional height
  base. Translate each size axis consistently and apply supported control bounds.
  Reject fields not actually consumed; do not hide this with new pixel assertions.
- **Status:** repaired in the third piece. ConfiguredPopover consumes popup size
  as percentages of the app viewport (the portal's explicit reference), providing
  a definite size-query container. Surface padding now uses configured geometry,
  not raw pixel strings. The slider wrapper consumes its width/height percentages;
  the MUI control consumes its x/y/width/height bounds and establishes the query
  container for rail/track/thumb. Managed heights use cqh and thumb width uses cqw;
  MUI still owns value-dependent track fill and thumb position. Both features use
  the same mechanism. After A04, obsolete surfaceWidth/surfacePadding fields are
  rejected by the generic part-key contract; the shared popup validator requires
  padding to leave positive content.
- **Current bases/config:** popup width=24% viewport width and height=4% viewport
  height; surface padding=6% horizontal/24% vertical; slider=100% of surface content;
  control=x3%, y0%, w94%, h100% of slider; rail/track height=20% and thumb w8%/h78%
  of control. These replace numbers formerly misread as pixels. No button bounds,
  row height, feature operation or gesture-lifecycle code changed.
- **Validation for A03:** UI build passed. Live renderer inspection measured both
  popups at the actual tall startup viewport and 760×700 minimum. The surface,
  slider, control, rail and thumb followed their declared percentages; a JSON-only
  change to slider size, control bounds and managed-part sizes changed the actual
  elements. Rail clicks changed both values and closed the popup, with zero layout
  diagnostics. Startup/minimum screenshots were inspected under
  `frame/.runtime/checks/slider-geometry/`. No broad suite or persistent test file
  was added. The inspection instance was closed before normal app relaunch.

#### A04 — High at audit; popup configuration contract repair complete

- **Evidence at audit revision:** `ConfiguredPopover.jsx:10,31–34` supplied a default placement,
  hardcoded z-index 1300 and 8px offset, while width/padding are free CSS strings.
  `frame/config.json:100,114` contains `220px` and `12px 14px`. The validator
  (`ConfigValidation.mjs:392–396`) checks only nonempty strings, not valid units,
  a sizing base or required fields. Popup `size` is required by adjustments but
  not used by ConfiguredPopover.
- **Why:** the popup API was added as an escape hatch around parent-relative
  configuration instead of completing the existing configured-part contract.
- **Impact / fix:** popup sizing is fixed, unknown/missing CSS can fall through to
  host defaults, and JSON padding changes can be overridden by inline styles.
  Give the shared popup one validated geometry/placement representation with an
  explicit reference base. Keep stacking as a named shared policy or validated
  config value; remove dead/conflicting fields and raw CSS escape hatches.
- **Status:** repaired in the fourth piece. Each adjustment popup explicitly
  configures `portal.placement`, `portal.offset` and `portal.zIndex`. The shared
  popup validator owns their supported values; there is no placement prop/default
  or hardcoded offset/stacking value in the renderer. Offset base is explicitly
  `anchor`: skid is a signed percentage of the trigger cross axis and gap is a
  percentage of its main axis, using Popper's resolved placement/reference bounds.
  Default gap is 20% of trigger height for bottom placement; viewport-relative
  popup dimensions and inner percentage geometry from A03 are unchanged.
- **Part contract:** components export `partConfigKeys` alongside `partKeys`.
  Discovery validates that map and requires a pure validator for custom options.
  ConfigValidation accepts only common fields plus keys declared for that exact
  part. Both adapters reuse `adjustmentPartConfigKeys` (`popup: ['portal']`), and
  their validator delegates to `validatePopoverConfig`. No component names were
  added to generic assembly. `surfaceWidth` and `surfacePadding` are no longer
  accepted anywhere in the active part schema.
- **Placement compatibility at A04:** its menu declared numeric `paddingEm`,
  replacing the last raw CSS string while preserving compact spacing. A08 later
  separated menu/list/item responsibilities and moved item padding to its own
  part. Surface/item/disabled states were left for that piece. No feature action, slider edit
  lifecycle, button sizing, photo operation or native window geometry changed.
- **Validation for A04:** UI build and focused discovery-contract checks passed.
  Renderer inspection verified placement, offset and stacking at startup/minimum
  sizes and after a JSON-only bottom-end/offset/z-index change. Font-relative menu
  padding matched its configured multipliers. Nine malformed/undeclared/raw-field
  cases were rejected before mount with exact-owner diagnostics and valid siblings
  preserved. Images and measurements are in `frame/.runtime/checks/popup-contract/`.
  No broad test suite or permanent test file was added. The inspection instance
  was closed before normal app relaunch. Native DIP, fonts and border units remain
  distinct from proportional control/portal layout.

#### A05 — High at audit; slider edit ownership and cleanup repair complete

- **Evidence at audit revision:** pointer/wheel used tokenized `beginPhotoEdit` / update / finish /
  cancel (`PhotoOperations.mjs:119–163`, `PhotoHistory.mjs:36–77`). Slider adapters
  use un-tokened `beginSize/beginRotation` and `finishSize/finishRotation`
  (`PhotoOperations.mjs:165–189`). `AdjustmentControls.jsx:69–83,114–147` keeps its
  own acceptance flags, resets them on blur, and adds a window pointerup listener
  without removing it in effect cleanup. Generic popover dismissal (`:64` and
  `ConfiguredPopover.jsx:18–25`) closes independently of that edit lifecycle.
- **Why:** token protection was added for the new canvas inputs but existing
  controls were not migrated. Several UI listeners still settle one global edit
  without identifying which gesture owns it.
- **Impact / fix:** an external Undo/commit followed by a late slider callback can
  call an un-tokened update and begin a new edit; a stale completion/cancel can
  affect another active edit. Use the existing history token owner for sliders
  too. The shared adjustment component should retain one gesture handle and pass
  it to update/finish/cancel; disable/dismiss/blur/unmount must explicitly settle
  that handle and remove listeners. Keep rollback in PhotoHistory, not JSX.
- **Status:** repaired in the fifth piece. `beginRotation`/`beginSize` reuse the
  existing photo-edit begin operation and return its handle. Rotation/Size live
  updates require a valid handle; finish/cancel verify token and photo identity
  and cannot settle another edit. Feature wrappers still return their own current
  value, without duplicating size/rotation math. Missing/stale/malformed handles
  are no-ops. All live adapters were migrated together; obsolete no-handle test
  calls are not a reason to reintroduce an ownership bypass (A14 remains open).
- **Shared lifecycle:** AdjustmentControls captures the handle and operation
  callbacks for the active pointer/keyboard edit. It subscribes to existing
  session state to close invalidated edits, and uses popup generations to reject
  callbacks from a previous opening. Escape/pointer cancellation rolls back the
  owned edit; release, outside dismissal, blur, disable and unmount finish it.
  Pointer release/cancel listeners are removed explicitly, pointer IDs are
  matched, and callbacks are suppressed after unmount. No new controller/service
  was added. ConfiguredPopover forwards only the dismissal reason to this owner.
- **Text dependency:** Rotation's draft now retains its own handle, so its blur
  and cleanup cannot finish a newly started slider or another control's edit.
  Text parsing, Enter and Escape remain local. Arrow-key release was left for
  A06 and subsequently repaired below; geometry, ranges, buttons and feature
  calculations were unchanged by A05.
- **Validation for A05:** focused operation checks passed for missing/stale/
  malformed handles, separate gesture history, cancellation and photo replacement.
  Live inspection passed for both slider paths, text-to-slider handoff, grouped
  Undo/Redo, Escape with late movement, reopened keyboard input, external Undo,
  outside dismissal, window blur, disable/unmount and listener removal. Window
  pointer listener counts returned to zero after settlement. A focused cancellation
  follow-up at startup/minimum sizes verified that only the matching pointer is
  canceled. No layout diagnostics or renderer errors occurred. UI build passed;
  no broad suite or permanent test file was added. Records are under
  `frame/.runtime/checks/slider-lifetime/`. Inspection windows were closed before
  normal app relaunch.

#### A06 — Medium at audit; keyboard completion repair complete

- **Evidence at audit revision:** adjustments began a keyboard gesture inside `onChange`
  (`AdjustmentControls.jsx:114–119`) and ignore commit only for an event named
  `keydown` (`:121–124`). Installed MUI's `Slider/useSlider.js:301–324` invokes
  update and committed callbacks for hidden-input value changes as well. The
  Rotation text adapter handles ArrowUp/ArrowDown on keydown but no keyup handler
  (`RotationControls.jsx:50–59,69–70`).
- **Why:** completion relies on event-type heuristics and separate editor logic
  rather than one explicit keyboard-gesture transition.
- **Impact / fix:** some input-change paths may close/commit early, while repeated
  Rotation field arrows can remain pending until blur/Enter. Distinguish typing,
  keyboard stepping and pointer input in the shared lifecycle; preserve the
  contract's key-release completion for stepping without forcing normal typing
  to commit every character. Treat MUI committed notifications according to the
  active gesture, not just a single event.type comparison.
- **Shared-slider repair in A05:** the slider begins keyboard edits in capture
  phase, ignores value-committed notifications while a keyboard edit owns the
  gesture, and finishes on the matching stepping key's release. Its repeated-key
  grouping/reopen path was checked in A05.
- **Status:** repaired in the sixth piece. Rotation owns the arrow-key release
  handler and its held-key metadata. The optional callback is forwarded by the
  shared value editor, not implemented as Rotation behavior in the shared UI.
  Repeated Up/Down keydowns reuse one owned stepping handle and finish when the
  last held stepping key is released. Unrelated/stale releases do not finish a
  new edit. Switching between typing and stepping settles the previous owned
  phase and starts a new one. Normal typing still commits on Enter/blur and
  cancels on Escape. No layout, range, operation math or new shortcut changed.
- **Validation for A06:** UI build passed. Focused live checks at startup and
  760×700 minimum verified repeat grouping/Undo, release completion without blur,
  unrelated/late releases, typing Enter/blur/Escape, mixed typing/stepping,
  multiple held arrow keys and external Undo invalidation. No renderer errors or
  layout diagnostics occurred. Screenshots and records are under
  `frame/.runtime/checks/rotation-key-release/`. No broad suite or permanent test
  file was added; the inspection window was closed before normal app relaunch.

#### A07 — Medium at audit; shared row/order/containment repair complete

- **Evidence at audit revision:** `FileControls.jsx:48–58` and `AdjustmentControls.jsx:86–89,154–158`
  duplicate slot/flex/gap application. FileControls validates total widths plus
  gaps (`:30–32`); `validateAdjustmentConfig` does not. Each part may be a valid
  percentage yet the sum can exceed 100 with flexShrink=0. File order is still
  the source array `['load','reset','save']` (`FileControls.jsx:8`) rather than a
  validated JSON order. Action Bar control y/height is repeated in three instance
  records; current equality is configured correctly but is not one shared rule.
- **Why:** the file group and adjustment group were implemented at different
  times, and common row mechanics/order were copied rather than reconciled.
- **Impact / fix:** oversized adjustments can overlap siblings despite valid
  config; changing a simple file order requires JSX. Reuse a small existing/shared
  row-slot mechanism where appropriate, with consistent width/gap containment.
  Keep feature composition in its owner and configure order in JSON. If equal
  Action Bar height is to remain a maintained rule, represent its allocation once
  rather than copying another hardcoded height into renderers. No new registry.
- **Status:** repaired in the seventh piece. `components/ConfiguredRow.jsx` owns
  slot/flex/gap rendering and validation for both baked groups. Feature owners
  supply named content/actions; row `order` lists every supported part exactly
  once in JSON. Defaults remain Load/Reset/Save and decrease/value/increase.
  Part widths plus gaps must fit 100% of the row's padded content width, with
  positive content area and one non-wrapping row in every declared visual state.
  Row gap/alignment state application uses the existing shared appearance owner;
  no palette, registry, fixed-pixel control override or feature math was added.
- **Parent allocation:** Action Bar's `layout.allocations.controls` declares
  y=8%, height=84% once; the three groups select it through `placement.allocation`
  and keep only their own width. Separators share a shorter named allocation.
  This is a generic optional section-layout contract, not a control-ID registry.
  ConfigValidation validates/selects the allocation and produces resolved bounds;
  unknown selections and competing child y/height are rejected, not overwritten.
  Parents without allocations retain their existing explicit vertical bounds.
- **Validation for A07:** UI build passed. Real Frame inspection at startup
  934×1359 and minimum 760×700 matched the A06 geometry within 0.2 DIP. JSON-only
  order changes worked for all three groups. Width/gap/padding and hover row
  alignment changes affected only the intended group; one parent allocation
  changed all three heights/insets without changing separators or Windows Bar.
  Reordered Load/Reset/rotation commands, editable degrees and both slider
  history/popups passed. Forty-two malformed row/order/allocation cases were
  logged and isolated; valid configuration remounted. No renderer errors occurred.
  Initial proof-selector mistakes were corrected; passing geometry checks were
  not repeated. Evidence is under `frame/.runtime/checks/configured-row/`.
  No broad suite or permanent test file was added. A08 slot-state routing was left
  for the next piece below. A09 section-flow mismatch was subsequently repaired
  in its own piece below.

#### A08 — High at audit; value/dropdown state routing repair complete

- **Evidence at audit revision:** `PlacementDropdown.jsx:39–50` applies the same `menu` state/visual
  object to popup paper and items, overrides display/padding, and leaves list
  typography/arrow/text state routing partly to MUI. Installed
  `InputBase/InputBase.js:190–194` sets disabled WebkitTextFillColor from its theme;
  `NativeSelect/NativeSelectInput.js:153–155` sets disabled arrow color. The local
  Select rules do not reset the disabled text fill to the configured color.
  `AdjustmentControls.jsx:99–106` likewise gives the input/unit implicit inherited
  layout/state paths rather than a fully declared common text/editor contract.
- **Why:** fixes targeted visible wrappers while nested MUI parts and portal
  surfaces were not assigned separate consumed configuration responsibilities.
- **Impact / fix:** a JSON disabled foreground need not reach displayed text;
  hovering an item also styles the enclosing paper. Configure surface, item and
  indicator responsibilities separately in the existing dropdown owner. Apply
  common configured states to MUI's actual visual slots, including text fill;
  define the value editor's shared content/disabled behavior once. Keep a simple
  dropdown; do not add a second theme or local palette.
- **Status:** repaired in the eighth piece. Shared ConfiguredContent explicitly
  resets nested text/native fill to the owning value/selector's configured state,
  including fonts and alignment. AdjustmentControls keeps its existing text,
  editor and unit composition; no standalone input/slider was recreated. The
  value-content contract is one non-wrapping horizontal row in all visual states.
  Shared ActionButton focus-within now participates in the existing state order,
  so focus cannot mask an invalid field's error color or a busy disabled state.
- **Placement parts:** `menu` is the surface, `list` its option parent, `item` the
  common option visual and `indicator` the arrow. Surface/list/item use explicit
  `paddingEm` x/y and `gapEm`, based on each part's own font size. Competing
  percentage spacing or fixed bounds/size are rejected for these intrinsic parts,
  not silently ignored. Indicator bounds use its selector parent's axes, with
  an explicit child container-query base for percentage visuals. Its `icon` names
  the existing shared icon registry; the default arrow glyph is preserved.
  Label text explicitly inherits selector appearance and native text fill.
- **First-mount repair:** installed MUI's Select height/min-height rule could win
  before reconfiguration. The shared fill/text reset now has stable specificity,
  preserving the same configured box on first mount and later reconfiguration.
  There is no theme, tuned pixel control layout or feature-specific color override.
- **Validation for A08:** UI build passed. Live checks reproduced the prior
  disabled fill mismatch and item-hover surface recolor, then verified configured
  disabled/normal/hover/focus/error colors, fonts, fill and alignment at startup
  934×1359 and minimum 760×700. Value popup opening, typing/arrow-release/Undo,
  keyboard/mouse Fit/Fill/Center and native-busy disabling stayed intact. Portal
  parts applied independent states and font-relative spacing; indicator-only JSON
  changes did not move the label or siblings. Forty invalid spacing/part/icon/
  value-composition cases were logged and isolated, including a disabled instance.
  No renderer errors occurred in passing checks. Native captures at both sizes
  were inspected. Evidence is in `frame/.runtime/checks/value-states/`; the final
  UI/glyph checks cover the latest renderer. No broad suite or committed test
  file was added. A09/A10 were left for subsequent pieces below; A11–A14 remain open.

#### A09 — Medium at audit; section geometry/flow repair complete

- **Evidence at audit revision:** `WindowLayout.jsx:24–42` switches every section into a sequential
  grid row if any section has `sizing`. It sorts by y, uses y only to add gaps,
  then clears top/height. `ConfigValidation.mjs:300–336` permits nonoverlapping
  side-by-side sections at the same y and does not constrain this flow topology.
  The content-sized branch also makes each child normal-flow without a sibling
  layout (`WindowLayout.jsx:45–54`).
- **Why:** intrinsic Bottom Bar support specialized the generic renderer into a
  vertical stack while validation kept the broader section-bounds contract.
- **Impact / fix:** a legal config with two sections sharing y but occupying
  different x ranges will be stacked instead of honoring its bounds. Either
  validate an explicit vertical-flow contract or implement tracks that preserve
  supported geometry. Before implementing deferred Bottom Bar Info, define its
  parent-owned row composition; do not simply add an absolutely positioned button
  to the current content-height stack.
- **Status:** repaired in the ninth piece. JSON now explicitly declares
  `sectionLayout.mode`. `vertical-flow` supports vertically disjoint declared
  footprints, fixed percentage tracks, intrinsic content tracks and at most one
  remaining-height owner. `absolute` supports non-overlapping two-dimensional
  bounds without intrinsic/remaining sizing. Missing/invalid mode is logged;
  no renderer inference or alternate layout is invented.
- **Flow contract:** bounds y/height establish declared order/footprints and
  window-relative gaps, not the runtime heights of content/remaining sections.
  Bounds x/width still determine horizontal placement. Side-by-side sections
  with overlapping vertical footprints are symmetrically isolated in flow mode,
  but are supported in explicit absolute mode. Multiple remaining owners are
  also isolated rather than given an unconfigured equal-weight rule.
- **Intrinsic contract:** a content section supports at most one enabled valid
  intrinsic child in normal flow, without sibling layout/native-safe-area
  positioning. Its child uses y=0, height=100 and no aspect ratio; x/width remain
  configurable. Unsupported bounds are logged, not cleared silently. Multiple
  enabled children isolate the content subtree; a disabled extra child does not
  create a conflict and malformed disabled entries still validate. Future Info
  needs an approved parent-owned row contract; neither that row nor Info was
  implemented by this repair.
- **Ownership:** ConfigValidation creates the section track/row plan after all
  isolation. WindowLayout only renders that plan. Disabling/removing flexible
  sections cannot switch the selected mode. Current JSON retains the same four
  sections, percentages, child allocations and appearance; photo/history/math,
  native geometry and FrameInfo's own text/padding calculation are unchanged.
- **Validation for A09:** the old accepted-but-stacked side-by-side configuration
  was reproduced live. Twenty-one focused checks of the actual validator and a
  UI build passed. Live startup 934×1359 and minimum 760×700 geometry matched A08
  within 0.2 DIP. Actual Load/cancellation messages proved Bottom Bar upward
  expansion/shrink and 1% padding without moving top bars or covering the body.
  JSON gap and intrinsic x/width edits applied; absolute side-by-side rendering,
  flow conflict isolation, multiple-content-child isolation and stable mode after
  disabling flexible sections passed. No renderer errors occurred. Native
  expanded-message captures at both sizes were inspected. Evidence is under
  `frame/.runtime/checks/section-flow/`. No broad suite or committed test file was
  added; the inspection instance was closed before normal relaunch. A10 was left
  for the following piece; A11–A14 remain open. Deferred Info/orchestration were
  not started.

#### A10 — High at audit; transactional photo replacement repair complete

- **Evidence at audit revision:** worker `image-worker/src/session.rs:15–20` replaces its current
  image immediately after preview creation. `ImageFileDialogs.cjs:46–50` then reads
  preview bytes and publishes native identity. Renderer replacement happens later
  in `ImageFileActions.mjs:28–36`. An error in preview read/delivery after worker
  success leaves the renderer on its previous photo; its generic error handling
  claims that photo is preserved (`:13,22`). The worker holds only the new photo.
- **Why:** Load/drop share the same path correctly, but replacement is committed
  independently at worker, desktop adapter and renderer boundaries without one
  acceptance/rollback contract.
- **Impact / fix:** after that failure, the old visible photo may no longer export
  because its photoId is stale. Make loading prepare an image/preview candidate
  and commit identity after successful transfer, or retain the previous worker
  image until acceptance. Keep this in file/worker owners; never work around it
  by resetting UI or adding another DropTarget-specific loader.
- **Status:** repaired in the tenth piece. The original failure was reproduced
  against the real old worker: an injected preview read failure preserved native
  photo metadata but made its old ID unexportable. Load now prepares one candidate
  without replacing current pixels. Explicit `accept_load` retains the prior
  pixels for rollback/old-ID export; `finalize_load` releases them only after
  renderer state acceptance; `discard_load` rejects or rolls back that exact ID.
  IDs are monotonic and safe for the JavaScript transport; storage is bounded to
  current plus one candidate/retained predecessor, not all historical images.
- **Native owner:** Load/drop share source validation, preview transfer and ticket
  handling in ImageFileDialogs. Preview read/unlink failure discards the candidate
  before returning failure. Metadata/source-protection changes occur on accepted
  identity and rollback restores their previous state. The next image operation
  carries the renderer's explicit current ID to reconcile lost acceptance or
  finalization replies. Null remains an explicit empty/black renderer state,
  including after reload; it does not select retained photo pixels. Stale ticket
  operations cannot settle a newer candidate. Disposal settles pending work before
  the owned worker closes; fatal renderer loss routes through normal app cleanup.
- **Renderer owner:** PhotoState prepares the blob URL and decoded preview before
  acceptance. Its private weak resource map keeps DOM images out of published
  metadata/history/IPC. ImageFileActions validates metadata and computes the
  document through existing PhotoOperations, then accepts the ticket and resets
  history/installs photo state together. Failed acceptance preserves old document,
  URL, history and saved key. PreviewPainter reads the already-decoded resource;
  it no longer starts a separate asynchronous post-replacement image load.
  Late completion after disposal discards only its owned candidate.
- **Completion semantics:** a finalization failure after local acceptance retains
  the accepted new photo and reports pending cleanup, not a failed replacement.
  Native reconciliation must settle that ticket before the next operation. URL
  cleanup errors are reported separately from that native reconciliation. No new
  service, layout/appearance rule, photo math, shortcut, overlay or orchestrator
  was added. Worker-crash/restart recovery and cross-session photo persistence
  were not added; export still requires its live owned worker.
- **Validation for A10:** full UI/worker build and six Rust tests passed (four new
  ticket/pixel tests plus two existing export tests). Twelve focused renderer-owner
  checks passed, including failure/disposal timing and URL release; six native-owner
  scenarios used the real worker to prove old byte-identical export, rollback,
  reconciliation, source protection and idempotent cleanup. Live Frame checks
  covered eight injected read/unlink/bytes/URL/accept/delivery/cleanup failures,
  actual disk-backed File drops, both finalization failure timings, stale tickets,
  unchanged old PNG bytes, retained inspection state and successful replacement
  history reset. PNG exports passed at 1200×1600, 2400×3200 and 3024×4032; accepted
  JPEG decoded at 1200×1600. Final reviewed-source checks proved reload/black-save
  recovery, visible decoded pixels and native captures at startup/minimum sizes,
  and clean owned worker exit while a delivered candidate remained. Passing checks
  had no renderer errors; diagnostic screenshots contain deliberate injected issues.
  Evidence is under `frame/.runtime/checks/photo-replacement/`. Broader/stale
  `frame/tests/` suites were not run or rewritten; A11–A14 remain open.

#### A11 — Medium: editing/menu/modal input isolation is scattered across handlers

- **Evidence:** `KeyboardShortcuts.mjs:8–10` excludes contenteditable, sliders,
  open popovers and modal surfaces. `PhotoPointerInput.mjs:21,78–83` uses a smaller
  selector and checks hover/focus, not the same blocked state; it omits buttons,
  contenteditable and dialog/popover presence. `PhotoWheelInput.mjs:36–48` checks
  canvas hit/busy/pointer gesture only. Pointer view start also differs from photo
  start (`PhotoPointerInput.mjs:47–48`): view pan is canvas-wide; photo edits are
  frame-only. That distinction needs to remain explicit rather than accidental.
- **Why:** canvas input and app shortcuts each added their own focus policy.
- **Impact / fix:** Space handling can consume a focused control's key while the
  cursor remains over the canvas; future overlays cannot rely on a common edit
  block. Share a small interaction-blocking predicate/state through existing
  interfaces, keeping pointer capture and wheel grouping in their current files.
  Modal/native busy state and genuine text editing must suppress photo input.
  Do not move all events into FrameSession or build a new global event framework.
- **Status:** confirmed divergent policy; specific overlay interactions are
  code-derived risks, especially while Information is still deferred.

#### A12 — Medium: busy protection depends too much on the caller

- **Evidence:** `PhotoOperations.mjs:179–186` stepSize checks photo-derived percent
  and direction but never uses `canEdit()`, unlike updateSize/rotateBy/reset.
  `UndoButton.jsx:10`/`RedoButton.jsx:10` ignore busy even though FrameSession
  (`:48–49`) refuses those operations while busy.
- **Why:** UI disabled behavior and operation guardrails were added independently
  instead of checked at their corresponding boundaries.
- **Impact / fix:** stepSize is unsafe for a future non-button caller, history
  controls can appear usable while doing nothing. Enforce canEdit in the operation
  and reflect busy in history adapters. Do not invent another state owner or copy
  the busy calculation into the shared visual primitive.
- **Status:** confirmed missing guards; current disabled size buttons mask the
  direct stepSize path. No busy operation was triggered during this audit.

#### A13 — Medium: diagnostics have one storage owner but incomplete origin/readability

- **Evidence:** `FrameSession.mjs:56` reports preview failure without component,
  instance, source or config identity. `DropTarget` supplies full origin but
  placement/photo input failures have no equivalent origin wrapper. Render error
  boundaries (`WindowLayout.jsx:6–14`) do not catch asynchronous event-handler
  failures. `LayoutDiagnostics.mjs:2–6` reduces the visible summary to code/path,
  despite the complete expected/actual/action message already stored at `:41`.
  `FrameInfo.jsx:4` also uses a folder-relative import to shared diagnostic logic
  instead of the stable alias used by other movable controls.
- **Why:** record persistence was centralized, but new callers were wired directly
  without carrying origin context or finishing the user-facing formatting path.
- **Impact / fix:** Bottom Bar can say where a code occurred without explaining
  what was skipped or what value was wrong; a moved nested status control may
  need import edits. Carry the initiating context through the existing action
  boundary, format a concise readable reason/action in the shared formatter, and
  use the stable alias for FrameInfo's dependency. Keep detailed records in the
  existing log; do not add banners or separate log services.
- **Status:** confirmed provenance/summary omissions. No new event failure was
  triggered. Existing record deduplication and persistence separation should stay.

#### A14 — Medium: retained checks and PASS claims target superseded UI contracts

- **Evidence:** `tests/popover-proof.mjs:63–68` still demands square buttons and
  frozen sizes 38.94/37.92/71.84. `tests/rotation-proof.mjs:32,124–126,209` modifies
  removed parts `degree/field/input`. `tests/rotation.test.mjs:81–96` creates a
  synthetic catalog without current input/options declarations and dereferences
  `parts.input`, which is absent from current Rotation config. Several proof
  scripts force `config.window.height` as "default" even though startup height is
  now monitor-dependent. Later Markdown sections still report these old runs as
  current proof of the implementation.
- **Why:** extraction/new user decisions changed the contract while checks and
  historical success paragraphs were left behind. Compatibility mappings such as
  `RotationControls.jsx:67` preserve old DOM naming without preserving old schemas.
- **Impact / fix:** these checks are not current evidence, and chasing them can
  restore behavior the user explicitly replaced. Retire/update obsolete assertions
  only when that maintenance is authorized; use proportional invariants and real
  exports of validators where checks are needed. Do not weaken tests just to make
  them green, add a broad suite, or reintroduce deleted parts. Mark old reports as
  historical rather than claiming those scripts pass now.
- **Status:** confirmed obsolete references by inspection; no tests were run or
  modified. This finding is not an instruction to prioritize tests over the app.

### Empty skeleton inventory — not implemented and not active duplicates

These files were checked as zero bytes. They do not export component IDs and are
not mounted. Preserve unrelated skeletons; do not fill them just because they exist.

- **Action Bar superseded standalone parts:** `DecreaseSizeButton.jsx`,
  `IncreaseSizeButton.jsx`, `PhotoSizeSlider.jsx`, `PhotoSizeValue.jsx`,
  `ResetButton.jsx`, `RotationLabel.jsx`, `SizeLabel.jsx`. Their active UI is baked
  into FileControls/AdjustmentControls; the file map must not promise a second
  implementation. Removing obsolete skeletons is later scoped cleanup, not this audit.
- **Windows Bar:** `AppIcon.jsx`, `ExportStatus.jsx`, `InfoButton.jsx`. AppIcon is
  intentionally unnecessary for taskbar-only artwork; Info is deferred and its
  eventual button belongs in Bottom Bar. ExportStatus is not an active control.
- **Bottom Bar:** `ExportSizeSelector.jsx`, `FitViewButton.jsx`, `ViewZoomValue.jsx`,
  `ZoomInButton.jsx`, `ZoomOutButton.jsx`. No additional Bottom Bar controls were
  approved by this audit. Export sizes exist in operations/worker configuration,
  but there is no implemented selector.
- **Information:** `overlays/information/InformationDialog.jsx`, `CloseButton.jsx`.
  Deferred; lack of a dialog is not a regression in the approved current UI.
- **Notices:** `overlays/notices/Notice.jsx`, `NoticeStack.jsx`, `DismissButton.jsx`.
  Superseded by Bottom Bar text; do not implement a second notification system.
- **Layers:** `desktop/LayerReceiver.cjs`, `logic/LayerMessages.mjs`,
  `logic/LayerState.mjs`, `image-worker/src/layer.rs`. Deferred/superseded ownership
  from A01; no layer logic is currently mixed into active photo output.

### Repair order and scope limits

1. **Done — A01:** reconciled the current agreement/target map to the latest user
   decisions, without app changes. Old validation is labeled historical; obsolete
   test files remain open under A14.
   **Done — A02:** consolidated icon/text/editable button hosts and JSON history
   icons without changing feature actions or layout.
   **Done — A03:** consumed proportional popup/slider sizes and control bounds,
   with explicit portal/container bases.
   **Done — A04:** configured/validated placement, anchor offsets and stacking;
   per-part options prevent unused/raw fields from being silently accepted.
   **Done — A05:** token-owned slider/text edits, reasoned settlement and listener
   cleanup; stale callbacks cannot revive or finish a foreign edit.
   **Done — A06:** degree-field arrow repeats commit on final matching key release,
   distinct from normal typing and protected against stale keyup.
   **Done — A07:** shared baked row mechanics/containment, JSON part order and
   parent-owned named vertical allocation; existing arrangement is unchanged.
   **Done — A08:** configured value/editor text fill and state precedence,
   separate Placement portal/indicator parts and stable first-mount sizing.
   **Done — A09:** explicit validated section modes/track plan and supported
   single-child intrinsic composition; current layout/Bottom Bar behavior kept.
   **Done — A10:** bounded ticketed replacement and decoded preview acceptance;
   failed handoff preserves the current photo/export, with scoped reconciliation.
   **Next piece: A11, shared editing/menu/modal input-isolation policy.**
2. Repair the existing popup/slider geometry and slot-state application at their
   shared owners (A03/A04/A08 done).
3. Make edit ownership/lifetime consistent across controls and canvas inputs
   (A05/A06 done), then close busy/input-isolation gaps (A11, A12).
4. Strengthen the existing parent/baked-row contracts rather than introducing a
   new layout/registration system (A07/A09 done).
5. Repair multi-stage load acceptance and diagnostic origin/formatting in their
   existing owners (A10 done; A13 remains open).

Preserve the parts that already fit: complete discovery before mount, stable
component IDs and aliases, generic parent-owned sibling gaps, shared photo math,
separate view state, common Load/drop path, source-overwrite protection, exact
configured export sizes, right-aligned native startup/maximize, taskbar identity
and Bottom Bar-only operational messages. This report is a scoped repair list,
not permission to redesign the application or start deferred orchestration.

## Target and status

The standalone `@APPS/frame/` currently implements its native window, four
configured sections, discovery/validation before mounting, diagnostics, inspection,
Undo/Redo, Load/drop/Save, Rust photo/black export, Rotation/Size, Placement,
photo pointer/wheel input, separate inspection state and Ctrl+S/Ctrl+Z.
These are implemented features, not a blanket compliance verdict: A11–A14 in the
source audit remain open. The current task is to repair that list piece by piece.
Info and background orchestration are deferred, not the next automatic features.
Preserve `output-frame/` as reference only; do not recreate/reconfirm the skeleton.
`AGENTS.md` defines the working rules and current boundaries.

Run from `frame/`: `npm.cmd start` for normal mode or `npm.cmd run inspect` for
development inspection. Normal startup shows the black frame, filename/status and
shared icon-only Load/Reset/Save buttons. Undo/Redo start disabled until an edit exists.
`window.startup: "workAreaHeight"` opens the native window at the current monitor's
usable height (taskbar excluded), using the approved 934-DIP content width and
aligning it to the right edge of the work area. This default applies on each launch; window-position persistence is
not implemented. On smaller displays, native width/minimum bounds fit the work area.
Windows taskbar identity is `com.yuzha.timemaxx.frame`. Native window creation
supplies the multi-resolution `frame/assets/app-icon.ico` and explicit pin/relaunch
metadata, including the frame directory for development launches. The process and
window share that App ID. The icon is not rendered in the app layout. Existing
Electron pins must be removed and recreated from the updated Frame window.
Earlier implementation evidence: the live Windows property store was checked for App ID, ICO resource, display
name and the complete relaunch command; all matched. The Maxx taskbar icon was
observed after relaunch. No renderer/layout changes or broad test suite were needed.
Rotation and Size controls start disabled until a photo is loaded. The Action Bar
uses one shared adjustment sub-parent for `[decrease] [value] [increase]`; each
value opens its configured slider popup.
JSON defines ±180° bounds, 0.1° precision/step and 90° button increments.
Rotation keeps its editable degree value while Size shows its percentage value.
Rotation changes photo preview/export only. Future overlay composition belongs to
the deferred background orchestrator, not Frame's photo operations.
The active arrangement is Load/Reset/Save in Action Bar, Undo/Redo in Windows Bar,
with vertical maximize/restore and Close/X visible among the window-action buttons.
Minimize remains configured with `enabled: false`. `FrameWindow.cjs` owns the
height-only toggle and its saved restore bounds. Startup displays the restore icon;
the first restore uses the ordinary configured window size, and later toggles
restore the actual previous bounds. Maximize returns to the same configured width,
full usable height and right alignment as startup. One shared native bounds function
owns both paths. Windows Bar uses the same generic sibling layout as Action Bar to keep
Placement, maximize/restore and Close/X spaced without overlap.
Earlier implementation evidence: the native button was clicked through two maximize/restore cycles: width
stayed unchanged, prior bounds were restored, and full-width Windows maximize
remained off. Startup/restore captures are in
`frame/.runtime/checks/vertical-maximize/`. Native config/syntax checks and the UI
build passed; no broad test suite was run.
Undo/Redo are at the far left, followed immediately by the left-aligned filename.
The filename is a transparent pass-through label over the draggable Windows Bar.
Load/Reset/Save are one baked `FileControls.jsx` group with equal wider boxes and centered
icons, 1% from Action Bar's right edge. Close/X is 1% from Windows Bar's right edge;
its box retains the Undo/Redo dimensions. Filename/history/Rotation remain unchanged.
Windows Bar and Action Bar each use 4% of window height. Buttons use 8%
top/bottom parent-relative insets and 84% height. Frame/body starts at 8% and
takes the remaining height above the content-sized Bottom Bar; its declared
85% footprint is not the runtime height.
The native control overlay is off; these custom buttons call normal native
window operations. X shares the exact MUI renderer and preset used by Load/Save.
Loading/replacing an image resets photo history. No fake edits are seeded.
The working rule is to close an existing target-app instance and launch the current
build after finishing changes and focused verification, leaving it open for the user.

## Slider popovers

Both sliders now open in a popup instead of occupying Action Bar width.
`components/ConfiguredPopover.jsx` is the one shared popup mechanism: a trigger
opens a portaled surface that closes on commit, Escape or an outside press.
Both open from their entire visible value control, not a small unit symbol.
Rotation remains editable. A03 now supplies a viewport-relative popup size and
parent-relative inner geometry. A04 now reads placement, anchor-relative offsets
and stacking from validated popup config. A05 now owns slider settlement through
history handles, including Escape/outside/blur/disable/unmount.

`components/AdjustmentControls.jsx` owns the shared adjustment composition,
value/editor trigger, popup slider and common adjustment validation. Rotation
and Size use the same `decrease/value/increase/slider/control/rail/track/thumb/popup`
part contract. Group/row allocations and managed slider parts use explicit
percentage bases after A03. Feature adapters supply state, labels, icons and
commands. ConfiguredRow owns common row mechanics/containment for adjustments
and file controls after A07. A08 now applies shared value-content resets and
configured state precedence to text/editor/unit, without changing its operations.

## Baked size controls and Reset

`action-bar/SizeControls.jsx` is the thin `photo.sizeControls` behavior adapter.
It supplies Size state/actions to `components/AdjustmentControls.jsx`, placed
between Rotation and the file group. `PhotoOperations.mjs` owns the size policy
(`size` in JSON: 10–400%, 5% step) plus `fitScale`, `sizePercentOf` and
`scaleFromPercent`; the centered-fill scale is the 100% reference. The shared
`file.controls` group includes a third part, `reset`, which restores the fitted
document through the same shared operation owner.

A slider drag is one grouped history step; the +/- buttons are discrete commits,
like the rotation buttons. Undo/Redo settle pending edits through the same owner.

## Baked file controls and right margins

One `file.controls` instance (`fileControls`) owns Load/Reset/Save composition,
labels/icons and actions. Shared ConfiguredRow consumes its JSON order and row
sizes and validates containment. Its shared ActionButton IDs are
`fileControls-load`, `fileControls-reset` and `fileControls-save`: named parts,
not separate layout registrations. File operations/history stay centralized.

The group occupies 25% of Action Bar width and uses its end lane with 1% parent
end padding. Each part uses 30% of group width, 100% height, with 5% internal gaps.
Parent layout computes x; no child stores a competing horizontal position.
Close/X is also in its parent's end lane, ending at 99%. Minimize remains hidden;
vertical maximize/restore and X are visible. Action Bar's common vertical bounds
come from its named parent allocation. Old two-button widths are not the target.

## Bottom Bar and deferred Info

Bottom Bar is the single outlet for operation/progress/success/error text and
readable diagnostic summaries. Currently it contains text only, with no selectors
or toast stack. The user approved an optional Info button before this text, but
deferred implementation. Do not put Info in Windows Bar or start it during repair.
It defaults to one text line, wraps and expands upward for longer messages, and
shrinks again for shorter text. Frame/body reflows rather than being covered.
Existing diagnostic records, deduplication and local logging remain intact.
Development-only layout inspection remains a separate developer surface.

`presets.status.geometry.paddingY` is **1% per side** of the text outlet's height;
1–2% is the requested range. Font, line height, horizontal placement and error
color remain configured. `FrameInfo.jsx` measures its own text and resolves that
percentage without preferred-height callbacks. Explicit `sectionLayout.mode:
"vertical-flow"` permits section `sizing: "content"` or `"remaining"`; omitted
sizing keeps fixed percentage height. Declared bounds establish section order,
horizontal placement, gaps and validation footprints, not live content/remaining
heights. The current content section has one intrinsic child; a multi-child row
is not currently supported or permission to start the deferred Info feature.

Earlier implementation evidence, not rerun for this repair: 27 Bottom Bar/contract tests passed, UI build passed, and
native Bottom Bar plus guardrail proofs passed at default/minimum sizes. The bar
measured **17.91px** for one line and **33.81px** for two lines at both sizes.
The proof creates its own photo fixture, checks actual Load success/cancellation,
upward growth/shrink, unchanged top bars, preview reflow, JSON changes to 2%
padding, errors/diagnostics in the bar, logging and invalid-padding isolation.
Native captures under `frame/.runtime/checks/bottom-bar/` were inspected. OS picker
interaction, other codecs and a broad export/rotation suite were not rerun.
Previous normal frame PID **17072** closed normally. Updated normal frame PID
**4956**, with owned worker PID **7260**, was verified and left running.

## Shared adjustment sub-parent: Rotation and Size

`components/AdjustmentControls.jsx` is the reusable sub-parent containing the
decrease button, value/editor, increase button and popup slider. The separator
remains a separate Action Bar sibling. Rotation and Size do not copy this UI.

```text
Action Bar
├── RotationControls (behavior adapter)
│   └── AdjustmentControls (shared sub-parent)
│       ├── Rotate left
│       ├── Editable degree value → popup slider
│       └── Rotate right
├── SizeControls (behavior adapter)
│   └── AdjustmentControls (same shared sub-parent)
│       ├── Decrease
│       ├── Percentage value → popup slider
│       └── Increase
└── ActionSeparator
```

`RotationControls.jsx` owns a scoped degree-text edit and maps its
commands into the shared sub-parent. `SizeControls.jsx` does the same for percent
state and size commands. The previous Rotation-specific MUI row, field measuring,
buttons, popup and slider composition were deleted. JSON uses the same named part
contract for both instances. JSON is the required authority for proportional
placement, appearance and states; the audit lists unconsumed fields/duplicate
rendering rather than claiming full compliance. `PhotoOperations.mjs` and
`PhotoHistory.mjs` remain the calculation and history owners.

Earlier implementation evidence: the UI build passed and the normal window was inspected directly (without a
second Electron instance) at `frame/.runtime/checks/shared-adjustment/live.png`;
both adapters mounted through the shared row with no Bottom Bar diagnostic. No new
UI test or fixed-pixel assertion was added.

## Placement control

`windows-bar/PlacementDropdown.jsx` is a configured action selector before the
vertical maximize/restore button and Close/X. Fit and Fill preserve rotation, recalculate scale from rotated
photo/frame geometry and center the photo; Center changes x/y only. The dropdown
owns labels/menu interaction, while `PhotoOperations.mjs` owns all placement math
and commits each effective action through `PhotoHistory`.
Its `menu`, `list`, `item` and `indicator` parts have separate configured visuals.
Intrinsic portal spacing uses each part's `paddingEm`/`gapEm`; the indicator has
parent-relative bounds and an explicit shared icon ID. Selector text inherits its
configured host state through the shared content reset, including disabled fill.

## Photo input and inspection

`PhotoPointerInput.mjs` and `PhotoWheelInput.mjs` are helpers attached by
`PhotoPreview.jsx`, not discovered component registrations. Both use the stable
`@frame` boundary and obtain geometry from `PreviewPainter.mjs`. The painter owns
rendering, frame hit testing and screen-to-frame coordinates in one representation.
`PhotoOperations.mjs` owns translation and cursor-anchored sizing as well as
rotation; buttons, sliders and wheel commands retain the same size/rotation rules.

`photoPreview.input` explicitly configures left photo drag, middle/Space view pan,
normal wheel sizing, Ctrl wheel rotation, Alt horizontal movement and Shift
vertical movement. Wheel unit conversion, sensitivity, idle grouping and cursor
states are JSON-owned. Existing reference interaction values are declared in JSON,
not hidden in event handlers. View zoom is an available `viewZoom` wheel action
when a binding is explicitly changed to it; no new toolbar or default zoom shortcut
was added. Its initial state and zoom bounds are explicit `view` settings.

`PhotoHistory` owns photo gesture tokens, grouped edits and cancellation. Tokens
expire on finish, cancellation, Undo/Redo, commits and photo replacement, preventing
old input from reopening an edit. `ViewState.mjs` and `ViewOperations.mjs` own
inspection state/cancellation separately; they do not change photo history,
dirty status, source images or exports. `FrameSession` composes these owners only.

The focused live input check passed: grouped drag and wheel Undo/Redo, Escape and
late movement, modifier commands, frame-only wheel scope, external Undo, view-only
pan/zoom, unchanged view-only PNG exports, replacement isolation and original file
protection. No renderer errors or layout diagnostics occurred. The UI build passed;
no broad test suite was run. Captures/exports are under
`frame/.runtime/checks/input-gestures/`.

## File dropping

`frame-body/DropTarget.jsx` is a separately discovered, configured drop-feedback
control. Its area follows Frame/body bounds; `pointerEvents: none` keeps normal
photo clicking, dragging and scrolling unobstructed. It listens only for file
drag/drop events and invokes loading only on an explicit drop inside that area.
The active outline is configured in JSON; there is no clickable replacement
surface or extra notification banner.

`ImageFileActions.mjs` owns one successful-load/replacement path for Load and Drop.
The preload resolves a disk-backed `File` with `webUtils.getPathForFile` and sends
it through the sender-checked drop channel. `ImageFileDialogs.cjs` owns the common
source validation, decoding and original-file identity/protection for both routes.
Exactly one supported image is accepted. Multiple files, folders, unsupported
types and decoding errors leave the current photo unchanged and use Bottom Bar
messages/structured diagnostics. Successful replacement resets photo history
through the same existing owner.

A10 extends this same path with prepare/accept/finalize/discard IDs. Native preview
transfer and renderer decode complete before photo/history replacement; the old
full-resolution image remains exportable until acceptance is finalized. Plain
photo metadata carries a URL while PhotoState privately owns its decoded resource.
Lost completion reconciles using the next operation's explicit current photo ID,
not a guessed global edit or another drop-specific loader.

The focused drop check passed with disk-backed Files through the real preload and
worker path: no picker on drop, no load/replacement on normal clicks, unobstructed
photo dragging, replacement history reset, invalid/multiple/corrupt-file isolation,
out-of-area rejection and protection of previously dropped originals. This checks
the app's drop path, not an automated Windows Explorer drag. Captures/fixtures are
under `frame/.runtime/checks/drop-image/`. The UI build passed; no broad suite ran.

## Keyboard shortcuts

`KeyboardShortcuts.mjs` owns only the approved Ctrl+S Save and Ctrl+Z Undo bindings.
It calls existing session actions, ignores repeats/busy operations and leaves text
editing, inputs, sliders, open menus, popovers and dialogs undisturbed. No Ctrl+O,
Redo or other app shortcut was added. `view/main.jsx` attaches the handler once and
detaches it on page teardown before disposing the session.

## Exact target files and ownership

Paths below are relative to `frame/` and list active application owners.
The audit's empty-skeleton inventory is separate: empty files do not define active
features or an implementation queue. In particular, Info is deferred to Bottom
Bar and layer/composition ownership is deferred to the background orchestrator.

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
│       │   ├── FileName.jsx            Current filename and accessible full-path information
│       │   ├── UndoButton.jsx          Invoke photo-history Undo
│       │   ├── RedoButton.jsx          Invoke photo-history Redo
│       │   ├── WindowActionButton.jsx  Configured minimize/maximize/restore/close behavior
│       │   └── PlacementDropdown.jsx   Fit/Fill/Center action selection before maximize/X
│       ├── action-bar/
│       │   ├── FileControls.jsx        Baked Load/Reset/Save group; invokes file actions and shared buttons
│       │   ├── SizeControls.jsx        Thin Size behavior adapter for shared AdjustmentControls
│       │   ├── RotationControls.jsx    Thin Rotation behavior adapter for shared AdjustmentControls
│       │   └── ActionSeparator.jsx     Configured Action Bar sibling separator
│       ├── frame-body/
│       │   ├── PhotoPreview.jsx        Canvas lifetime and interaction subscriptions
│       │   ├── PhotoPointerInput.mjs   Photo drag and inspection-pan gestures
│       │   ├── PhotoWheelInput.mjs     Frame-scoped wheel/modified-wheel interaction
│       │   └── DropTarget.jsx          Drop feedback and image-drop handoff
│       └── bottom-bar/
│           └── FrameInfo.jsx           One expanding text outlet for operation messages and diagnostics
├── logic/
│   ├── FrameSession.mjs                Coordinate session lifetime/subscriptions and UI state
│   ├── WindowActions.mjs               Renderer window actions, native state and subscriptions
│   ├── PhotoState.mjs                  Loaded photo/preview identity, output choice and saved key
│   ├── PhotoOperations.mjs             Shared sizing, rotation, placement and reset rules
│   ├── PhotoHistory.mjs                Current document and optional Undo/Redo tracking
│   ├── ViewState.mjs                   Inspection zoom/pan state
│   ├── ViewOperations.mjs              View-only zoom/pan operations
│   ├── ImageFileActions.mjs            Load/save coordination and accepted export snapshot
│   └── KeyboardShortcuts.mjs           Shortcuts with input/menu/modal isolation
└── image-worker/
    ├── Cargo.toml                      Independent image worker crate; no stamp-engine dependency
    └── src/
        ├── main.rs                     Worker entry and request/reply loop
        ├── protocol.rs                 Photo load/export request and response contracts
        ├── session.rs                  Worker photo identity/lifetime
        ├── photo.rs                    Decode/orient photo and prepare preview pixels
        └── export.rs                   Render photo/black snapshot and encode output image
```

### Contract edges to preserve during implementation

- Discovery registers renderable component exports, not helpers. The active painter
  is `view/preview/PreviewPainter.mjs`, imported through a stable `@frame` alias.
  Moving PhotoPreview between parents does not move or rewrite its painter.
  Pointer/wheel helpers follow the same placement-independent dependency rule;
  they are not component registrations.
- Controls obtain the resolved instance config and shared session/actions through
  a consistent injected interface/context. Do not make a movable control depend
  on its parent ID, filename, or folder-specific relative import to shared logic.
- InformationDialog is deferred, not a section-specific assembly registry. Its
  eventual Info trigger belongs before Bottom Bar text, not in Windows Bar.
  Its children must follow the unified mechanism and configured relationships.
  Operational notifications remain Bottom Bar text, not an overlay.
  Former bottom-control/notice skeleton files remain untouched and unimplemented;
  they are no longer the Bottom Bar target. Future view/output controls need an
  approved location elsewhere before implementation.
- ConfigValidation owns structural matching and uses shared config/appearance
  mechanisms from `@APPS/components/` where they fit the contract. Do not create a
  competing palette/resolver. ComponentDiscovery gathers facts; WindowLayout
  mounts validated results; neither takes over validation or diagnostics policy.
- LayoutDiagnostics owns issue identity, deduplication, formatting and summaries.
  DiagnosticLog only persists its records. Future overlay receipt, decoding,
  clearing and accepted-revision rules belong to orchestrator owners outside
  Frame. Do not activate the obsolete empty Frame layer skeletons.
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

`@APPS/components/ActionButton.jsx` is the intended shared MUI button/icon owner,
not a section registration. FileControls and WindowActionButton delegate rendering
to it and retain separate domain behavior/config validation in their assigned
folders. A02 is now repaired: value controls and Undo/Redo also use this shared
renderer. Editable values use its non-button host; history icons come from JSON.
Do not weaken folder guards or move feature behavior into the visual primitive.
The consumer's Vite config resolves shared React/MUI/Emotion imports to frame's
declared dependencies, not an undeclared ancestor installation.

`@APPS/components/ConfiguredRow.jsx` owns common baked row/slot placement and
containment. FileControls and AdjustmentControls supply each part's content;
JSON supplies order, sizes, gaps, padding and alignment. It is not a discovered
control or a registry and contains no file/photo/history operations.

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
  and isolates hook failures. FileControls owns labels/icons and file-row validation;
  PhotoPreview owns its inset options. Adding a control does not add its rules to
  the unified layout file.
- `partConfigKeys` declares custom options for existing named parts. Discovery
  validates its part names/key lists; generic validation permits those additions
  only on the declared parts, while the component/shared validator owns values.
  Portal and font-relative padding fields do not become global CSS escape hatches.
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
  immediate parent axes, left anchored and vertically centered. Current Action
  Bar controls intentionally omit it so all buttons/values have equal height
  despite different widths. Do not restore square constraints from old proofs.
- Components declare `partKeys` and required configuration capabilities. Discovery
  gathers these facts; ConfigValidation resolves every named part and checks all
  declared capabilities before mounting. Invalid rotation settings isolate only
  dependent controls, not Load/Save/history/preview. Diagnostics retain exact paths.
- The shared adjustment uses decrease/value/increase/slider/control/rail/track/
  thumb/popup parts; old independent input/degree/field parts are not the current
  schema. Positioned control bounds and proportional part sizes must actually be
  consumed and validated. A03 repaired control bounds, percentage translation
  and popup size bases. A04 repaired placement/stacking and per-part schema work.
  MUI owns value-driven track fill and thumb position.
- `active` and `error` join supported states. The input, degree label and slider
  managed parts receive their applicable focus/error/disabled/active state styles.
  The native input reset only inherits its configured owner's font/color/alignment;
  it does not introduce tuned dimensions, padding, colors or a competing theme.
- PhotoHistory owns live-edit grouping, cancellation and pending Undo availability.
  Typing finishes on Enter/blur; slider dragging finishes at pointer release and
  keyboard repeats at key release/blur. Escape restores the gesture's starting
  document; canceled pointer movement cannot restart it. Button edits, Undo/Redo,
  Load and Save settle pending edits through that same history owner.
- Continuous UI edits carry that owner's token through update/finish/cancel.
  Slider and degree-text cleanup must never finish a global edit by omission of
  its handle. Shared popup dismissal reports a reason; the input owner decides
  commit versus rollback and removes its own listeners/subscriptions.

## Structure contract

One unified layout mechanism creates configured sections across the window's
100% area. Section definitions hold ID, folder, bounds, colors and other visuals.
Sections are Windows bar, Action bar, Frame/body and Bottom bar. Windows area may
instead be reserved separately, leaving three content sections. Native-caption
mode respects its measured safe area. Current custom-caption mode
uses the full configured Windows Bar; no unused native control space is reserved.

JSON must declare `sectionLayout.mode` as `vertical-flow` or `absolute`. Flow
requires vertically disjoint declared section footprints, with at most one
remaining-height section. Absolute mode preserves two-dimensional bounds but
does not accept intrinsic/remaining section sizing. ConfigValidation selects and
plans the supported mode before mounting; it never changes mode after isolation.
Intrinsic sections currently allow one normal-flow child with y=0, height=100,
no aspect ratio, and configured x/width. Multiple children require a separately
approved parent composition contract rather than an implicit source-order stack.

Control folders are `windows-bar/`, `action-bar/`, `frame-body/`, `bottom-bar/`,
with owned overlay controls. Do not create per-section parent components with
manual child imports. A build-time catalog discovers files from those folders;
each section accepts only files from its assigned folder. Move a control's file
and change JSON parent/placement to relocate it; no assembly/behavior edits.

Configured sections may own a generic row layout with one `siblingGap`, start/end
padding and ordered start/end lanes. Without named allocations, children provide
width and vertical bounds but no `x`. With `layout.allocations`, the parent owns
named y/height pairs; children select `placement.allocation` and provide width
only. ConfigValidation resolves all bounds before WindowLayout mounts them.
Action Bar shares one control allocation across File/Rotation/Size and a shorter
separator allocation; neither leaf assembly nor feature behavior places siblings.

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
  from instance identity. FileControls is one instance with named Load/Save parts;
  their DOM IDs derive from the group ID rather than their source filename.
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
photo preview and Rust photo/black export. It never imports, builds, starts or
calls engine/input, interprets stamp settings or generates stamp content.

Future Input/engine prepares the overlay; a background orchestrator owns receipt,
clear/revision coordination, composition and combined export. It creates no new
window or duplicate Frame preview. Frame remains the single photo surface and may
display a finished combined preview through an explicit interface; Input remains
the settings screen. Frame supplies photo output through an explicit contract,
not access to its mutable internals. This integration is deferred, not current work.

Photo transforms affect photo only. View transforms affect inspection only.
The orchestrator must preserve its overlay independently of photo replacement,
reject stale/cleared results and export the accepted combined revision. Those are
future orchestration acceptance criteria, not missing Frame layer features.
Preserve original-file protection, photo replacement, shortcuts, history, notices,
black output and 1200×1600 / 2400×3200 / 3024×4032 export sizes.

## Current file-slice ownership

| Owner | Implemented responsibility |
| --- | --- |
| `FileControls.jsx` | One baked file-behavior instance, three named parts (load/reset/save), feature-owned labels/icons/actions and delegation to shared ConfiguredRow/ActionButton. |
| `components/ConfiguredRow.jsx` | Shared JSON-order row/slot rendering and containment validation for FileControls and AdjustmentControls. No feature behavior. |
| `components/ConfiguredContent.mjs` | Shared nested-text resets, ordered host/slot state adapters and intrinsic font-relative spacing validation. Uses the existing appearance resolver. |
| `components/AdjustmentControls.jsx` / `SizeControls.jsx` / `RotationControls.jsx` | One reusable proportional adjustment sub-parent; thin Size and Rotation behavior adapters use the same named-part contract. |
| `PhotoOperations.mjs` | Shared size and rotation policies, fit/percent/scale rules and history-grouped commands. |
| `components/ActionButton.jsx` (under `@APPS`) | One rendering/icon mechanism shared by file and window action registrations; no native/file behavior or app-specific appearance. |
| `WindowActionButton.jsx` / `WindowActions.mjs` / `FrameWindow.cjs` | Config-driven window-button behavior, renderer event subscription and whitelisted native window operations; normal close/worker cleanup. |
| `ImageFileActions.mjs` | Common Load/drop ticket sequencing, busy/cancel/error/save, decoded acceptance and scoped cleanup; calls existing state/history/math owners. |
| `PhotoState.mjs` / `PhotoHistory.mjs` / `PhotoOperations.mjs` | Photo/preview resource identity and saved state; plain published metadata; document/history plus unchanged centered-fill/export-transform rules. |
| `ImageFileDialogs.cjs` | Native file selection/source protection and ticket transfer/acceptance/rollback/reconciliation. |
| `ImageWorker.cjs` | Persistent local process, attributed NDJSON replies, operation failures and shutdown. |
| `image-worker/src/` | Standalone protocol/session, oriented decode, full-resolution photo rendering, matte and PNG/JPEG encoding. No engine/input dependency. |
| `PhotoPreview.jsx` / `view/preview/PreviewPainter.mjs` | Relocatable configured canvas, stable feature helper, preview lifetime and drawing of the published transform. |
| `FileName.jsx` / `FrameInfo.jsx` | Read-only filename and operation status presentation. |

`output-frame/` remains unchanged and is only a reference. Frame implementation
uses its own declared owners; no old controller or stamp runtime was copied in.

## Delivery sequence

1. **Current task: repair A01–A14 piece by piece**, using the audit's repair order
   and per-finding status. A01 documentation and A02 shared button rendering are
   complete; A03 geometry, A04 popup contracts and A05 edit ownership are complete.
   A06 field release and A07 row mechanics/order/validation are complete.
   A08 value/dropdown states and A09 section geometry/flow validation are complete.
   A10 transactional replacement is complete. A11 input-isolation policy is next.
   Later findings remain open.
2. Preserve implemented photo/file/history/input features and the latest UI.
   Make each repair in its existing owning files; remove directly superseded code
   after checking callers. Do not replace the app with another framework or host.
3. For app repairs, use focused checks appropriate to the actual change, relaunch
   and leave the updated normal app running, then perform the scoped checkpoint.
   For documentation-only repairs, follow the notes-only exception: no automatic
   app checks/relaunch/checkpoint.
4. Info, export-size UI and background integration remain deferred. Reuse the
   repaired UI mechanism in `ui-control` only when that work is requested. Apply
   ownership, not the UI schema, to the headless engine. Do not add Frame layer
   owners to make the old acceptance checklist appear complete.

### When a check fails

Stop the failing change and inspect the producing owner plus affected consumers
in the map. Record the requirement, actual behavior, ownership/config gap and
structural correction in this document in place. Correct the owning representation
or boundary, then run the focused proof for that change. Do not apply downstream
CSS overrides, silent defaults or special cases to conceal the gap. Do not
re-audit unrelated files or repeatedly reconfirm an already-correct skeleton.

## Acceptance checklist

Checked items describe implemented structure or earlier evidence, not a fresh
runtime verification of the audited revision. Open A11–A14 findings qualify
those claims. Deferred features are listed separately and are not this repair's
definition of done.

- [x] Stable component identity survives filename rename (Undo renamed during relocation proof).
- [x] Shared component/preset reuse works; baked Load/Save parts use one fileAction preset and shared renderer.
- [x] Discovery and validation precede mounting; duplicate component/instance IDs are isolated in contract checks.
- [x] Disabling an instance in JSON hides it without a false missing-instance log.
- [x] Undo's actual button color/height follow JSON and Redo remains unchanged.
- [x] Rotation color/height changes JSON only and affects the actual field; number
      and degree symbol remain aligned, while implemented Load/Save stay unchanged.
      Reset and Placement are implemented through their own configured owners.
- [x] Resizing the Action Bar changes child height by its configured percentage and leaves Bottom Bar unchanged.
- [x] Moving Undo/Redo between folders plus JSON relocates them with no parent code
      or behavior edits; current physical files/parent IDs place them in Windows Bar.
- [x] Load/Save are physically registered in Action Bar; custom X is in Windows Bar
      and uses the same shared renderer/preset without weakening folder guards.
- [x] Minimize is JSON-disabled; vertical maximize/restore and Close/X are visible.
      Startup/maximize share the narrow right-aligned work-area target, and restore
      returns to previous bounds. The native control overlay remains off.
- [x] FileControls/Save and Close/X end 1% from their respective bar edges.
- [x] Intentional folder/parent mismatch logs a readable, deduplicated record and
      leaves valid controls usable; inspect repeat counts and persisted records.
- [x] Inspection mode displays boundaries/IDs/source and is absent in normal mode; summary is readable at both sizes.
- [ ] No independent theme, palette, tuned CSS, ignored config or visual fallback.
- [x] Standalone photo/black PNG/JPEG exports work without either producer module present.
- [ ] Native default/minimum screenshots include caption areas, overlays and long
      text; Action Bar stays on one row, all its controls have equal proportional
      height, and Bottom Bar remains the status outlet with no redundant title/VIEW.
- [x] Bottom Bar defaults to one line with 1% top/bottom padding, expands/shrinks
      for multiline messages, preserves preview space, and replaces diagnostic banners.

Deferred, outside the current repair: optional Info before Bottom Bar text;
export-size selection UI at an approved location; background orchestration with
its own set/clear/stale-revision and combined preview/export acceptance. No
separate input or orchestrator Frame display and no Frame-owned layer composition.

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

## Historical verification — not the current target or current PASS evidence

The following records describe earlier revisions, layouts, schemas and proof
scripts. References to square buttons, old independent Rotation parts, inline
sliders, older sizes, old locations and old PIDs are historical only. They must
not drive current repairs. A14 records the obsolete checks still present on disk;
they were not rerun by the audit or by documentation repair A01.

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

These historical records do not establish readiness of the audited revision.
Use the current audit/status and `AGENTS.md`, not these former implementation
recipes, to determine the next repair. Additional application shortcuts are not
approved. Info, export-size UI and background orchestration remain deferred;
Frame's empty layer skeletons are not active feature requirements. Prior codec
fixtures do not prove every format or EXIF variant. Future approved controls must
follow the same exported-ID/config interface without claiming untested behavior.
