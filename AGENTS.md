# @APPS working agreement

Work only inside `@APPS` unless the user authorizes another location. Follow the
user's current request. `frame-current-state.md` describes the implemented Frame
app and its active boundaries. Keep notes current in place; do not accumulate
superseded plans, decision histories or competing recommendations.

## Notes-only tasks: strictly no skill or completion ritual

When the request is only to take or record a note, save the requested note
directly in the existing designated file. This includes recording decisions and
notes-only updates to agent instructions. Agents must follow this rule strictly.

Do not start or repeat skill routing, skill reading/acknowledgement/status calls,
implementation planning, code review, builds, tests, app relaunches or automatic
commit/push checkpoints merely to save a note. Do not expand note-taking into
application work. Only perform an additional operation if the user explicitly
requests it or the task actually includes application code/configuration changes.

Notes-only work is not app build work and is exempt from the completion ritual
below. Application changes still require their normal relevant checks, relaunch
and Git checkpoint. Notes accompanying application changes do not exempt those
application changes.

## Strict task-based skill selection

For application work, select only the relevant Yuzskill groups from these six:

| Skill | Apply when the task needs |
| --- | --- |
| `engineering-quality` | Implementation scope, change discipline and outcome reporting. |
| `modular-architecture` | Component ownership, composition, boundaries or shared logic changes. |
| `shared-ui` | Building or changing reusable controls and feature UI composition. |
| `stack-guidance` | Stack-specific implementation or API guidance. |
| `verification-and-review` | Relevant validation, debugging or a requested code review. |
| `planning-and-delivery` | Substantial multi-step work that needs a delivery plan. |

Agents must match skill guidance to the actual task and follow this selection
strictly. Do not activate or act on all six by default. Do not manufacture
planning, architecture changes, audits or tests just because a skill is available.
A small local adjustment stays small; unrelated skills remain unused. The list
is a selection menu, not a mandatory six-step ritual.

The notes-only exception above still applies: taking a note does not activate
any of these skills. Separate documentation helpers such as Context7 are not
additional Yuzskill groups or a reason to run the whole list.

## Goal and stage

The standalone `frame/` parent-child contract is complete. Folders identify
ownership; files identify jobs; source sections identify where to fix them. Any
future Input sections or engine work starts only from a new explicit request.

Keep unrelated empty skeleton files empty. Do not infer a new work queue from them.
Notes must distinguish implemented features from deferred requirements. The user's
latest explicit decisions take precedence over older examples and historical tests.

## Unified parent-child mechanism

- One layout mechanism reads section IDs, assigned folders, bounds and visuals
  from `config.json`, divides the window's 100% area, and creates containers.
- Sections are Windows bar, Action bar (`action-bar/`), Frame/body, Bottom bar.
  Config may include the Windows area as section four or reserve it separately
  from three content sections. Respect measured native caption safe areas.
- Do not create section-specific parent JSX files that manually import/list
  children. Discover components only from the assigned folders through a
  build-time catalog; no browser filesystem access is needed.
- Each control file exports a stable component ID independent of its filename.
  JSON gives each instance its stable ID, component ID, `parentId`, `enabled`,
  bounds and visuals. A shared component may serve multiple configured instances.
  Baked FileControls is one discovered instance with Load/Reset/Save named parts
  in that order. Its visual controls use the shared button primitive/preset;
  native file behavior stays with file-operation owners.
- Move a control by moving its file and changing its JSON parent/placement.
  Do not edit assembly code, behavior, or a hand-maintained registry.
- Discover and validate the complete catalog first; mount valid results second.
  Detect all duplicate component/instance IDs before mounting. Do not select a
  duplicate based on discovery order. Keep these stages in the unified mechanism.
- `enabled: false` intentionally excludes an instance from mounting and from
  missing-instance diagnostics. It does not excuse malformed entries or duplicate
  identities. This differs from temporarily disabling an interactive button.
- Assembly owns placement/discovery, never control behavior or photo/history
  rules. Shared operations retain one explicit owner.
- Parent sections own sibling order, lane alignment and external gaps through the
  generic configured layout; children must not place their siblings. Baked
  sub-parents own their internal composition through the same configuration
  authority, not a section-specific assembly registry.

## Current UI decisions

- Windows Bar and Action Bar each occupy 4% of window height. Action Bar's
  rotation, size and file controls share equal proportional height and vertical
  insets; different widths are allowed. Do not restore obsolete square-size rules.
- Rotation and Size use one shared adjustment sub-parent. Its whole visible value
  control opens the popup. Rotation's value remains editable. Shared UI owns the
  common rendering/input mechanics; adapters supply feature values and commands.
- Action Bar contains one standalone/orphan Edit button with a pencil icon after
  Size. Its approved command toggles the Input screen in `ui-control/`:
  closed → open, open → close. Input is frameless with no caption, native controls,
  title text or reserved Windows-Bar area. On each opening its width is 40% of
  current Frame width, height is the full current monitor work area excluding the
  taskbar, and its right edge touches Frame's left edge: `[ Input ][ Frame ]`.
  Input renders the enabled baked section cards from `ui-control/view/sections/`:
  a language section, whose body hosts the global language dropdown
  (English/Indonesian) that swaps the whole locale layout; a code-generator
  section, whose body hosts a value box (double-click copies it) beside a
  Generate button that produces a 14-character base-24 code; and a time section,
  whose shared 24/12-hour dropdown formats three editable value boxes. Four
  typed digits normalize to HH:MM, double-click copies, and each box owns a
  popup hour/minute picker; Generate fills the main box from the two range
  bounds; and a date section, whose DD/MM/YYYY value box opens a full-month
  calendar grid on single click and copies on double-click, with day and month
  dropdowns offering full and short locale names (`Senin / Sen`, `Monday / Mon`,
  and the same for months). The placeholder chassis stays configured but disabled
  (`enabled: false`); card headers take their height from configured `paddingY`.
  Cards share `components/SectionCard.jsx` (header expand/collapse, auto-compact
  body); the language, time and date dropdowns share `components/ConfiguredSelect.jsx`,
  and the time/date pickers use `components/ConfiguredPopover.jsx`. A content-sized
  section hugs its card instead of reserving its bounds height. It has no task
  content or data. Task content and generator behavior are future explicit
  requests, not an implied work queue.
- Startup and vertical maximize use the approved narrow configured width, full
  monitor work-area height excluding the taskbar, and right alignment. Restore
  returns to previous bounds. Native geometry is not photo or section-layout logic.
- Artwork is for the native window/taskbar/pin only; do not render an AppIcon in
  the layout. Minimize is hidden; vertical maximize/restore and Close are visible.
- Only Ctrl+S Save and Ctrl+Z Undo are approved application shortcuts. Do not add
  Ctrl+O or Redo bindings. Configured preview wheel modifiers and Space-panning
  remain separate inputs; text/menu/dialog editing retains its keys.
- Bottom Bar remains the operational text outlet with 1% vertical padding and
  content-driven expansion. The optional Info button is deferred; if implemented
  later it belongs before that text, not in Windows Bar. No toast/banner system.

## UI and LOGIC sections

Mark applicable source sections with `// UI` and `// LOGIC` (or the language's
comment syntax). Do not add fake UI sections to logic-only files or comments to
JSON. Empty skeleton files stay empty until implementation.

- **UI:** rendering and UI-specific config application; no hardcoded appearance
  or fallback styling. The unified layout owns parent assembly.
- **LOGIC:** local events, validation and behavior; call shared operations rather
  than copying their calculations.

One owning file per local fix: change intended Rotation height/color in JSON;
fix common value layout/config application in AdjustmentControls; fix unique
degree-text parsing/Enter behavior in RotationControls; fix math shared by
slider/field/wheel in PhotoOperations. The examples describe existing owners,
not permission to recreate deleted standalone input or slider components.
Do not duplicate logic to force one-file changes. Contract changes may require
coordinated consumers; explain why. Relocation is a file move plus JSON update.

## JSON owns appearance

Every visible section, control and logical part resolves its colors, visual
states, bounds, padding, spacing, alignment, typography, icons, borders and
shadows from its config or explicitly named preset. Use percentages of the
immediate parent's width for x/width, height for y/height. Define spacing and
portal-part bases explicitly; distinguish native DIP, fonts/borders and pixels.

Shared adapters/CSS implement resets, fill, drag/focus/pointer mechanics and
config translation. No custom app theme, independent palette, MUI theme sizing,
component-local tuned visuals, or selector-based stylesheet stored in JSON.
Shared UI belongs in `components/` without a redundant `src` layer.

## Guardrails, logs and inspection

Validate identities, parent/folder matches, files/config, bounds, visuals, actions,
presets and supported parts. An isolated mismatch must not break the whole app.
Skip conflicting/invalid components; isolate invalid section subtrees. Keep valid
controls running. Do not silently reassign parents or invent replacement visuals.

One shared diagnostic owner writes structured local records and readable messages
with issue code, component/instance ID, file/config path, expected/actual values,
action, timestamps and repeat count. Deduplicate identical issues per run. Show a
non-blocking summary. Example: `undo: found in windows-bar/, config assigns
actionBar; component skipped`. Logging failure must not crash the app.

Provide development-only layout inspection mode: section outlines plus component
ID, instance ID, parent ID and source filename. It is off in normal use, does not
intercept normal controls, and reads its visual settings from development config.
No separate inspection framework/service is needed.

## Standalone boundaries

- `frame/` owns its window, output settings, photo editing, photo preview and
  standalone photo/black export. Its only approved Input link is the lazy public
  launch-only contract `ui-control/screen.cjs`: toggle one native Input screen
  and close it with Frame. Missing/invalid Input must not break Frame startup/export.
  No Input internals, data integration, build dependencies or engine calls/launches.
  It does not interpret overlay settings or own overlay
  composition, clear/revision arbitration or combined export.
- `ui-control/` owns a frameless window shell rendering its baked section cards
  (composed from shared `components/SectionCard.jsx`), its React/MUI renderer,
  native geometry config, scoped config/state/diagnostic preload, and its own
  per-section selection persistence. It has no task logic or data.
  `ui-control/config.json` owns
  frame-relative width, work-area-relative height, adjoining-left placement,
  native-frame flags and background; computed native bounds use DIP. Its title is
  metadata only, never rendered. Input has its own build under `ui-control/`;
  Frame does not build Input. `ui-control/state.json` holds only the last
  selection made inside each section instance, one bucket per instance; a
  discovered component declares what it persists through `stateKeys`. Outputs
  are not selections: `ui-control/code.json` is a generic `sections` envelope
  keyed by instance id — `codeGenerator.code`, `time` (`value`, `from`, `to`,
  `hourFormat`) and `date` (`value`, `dayMode`, `monthMode`). Each bucket is replaced atomically after any change, never kept
  as a log; a future overlay reads `sections.time` and `sections.date` directly. Missing or
  damaged files never block Input and fall back to configured defaults. No
  preview, Frame/file bridge, engine or overlay. `engine/` and overlay behavior
  are not implemented.
  Rapid toggles are serialized; closing Input leaves Frame alive. Bounds are
  recalculated when opening, not saved from manual coordinates or tied to photo state.
- Future joint routing and composition belong to a background orchestrator with
  explicit photo-output/overlay contracts. Input renders only its placeholder
  chassis; Frame remains the one visible photo surface. The orchestrator creates no window or
  duplicate preview, and Input creates no duplicate Frame display. Frame may
  display a finished combined preview supplied by that orchestrator without
  interpreting overlay content. Combined Save is coordinated there. Do not
  implement this integration until the user explicitly requests and approves it.
- Photo transforms affect photo only; view transforms affect inspection only.
  Future stale-overlay rejection, clearing and accepted-revision consistency are
  orchestrator responsibilities. Photo replacement must not mutate its overlay.
  Existing empty Frame layer skeletons are not active responsibilities or
  authorization to add layer logic to Frame.

## Proof and discipline

Prove JSON changes actual control appearance without affecting siblings; parent
resize uses parent-relative geometry; one Load/Reset/Save preset changes all; moving
Undo/Redo needs only file moves and JSON edits; malformed entries are logged and
isolated. Prove disabled instances, filename-independent IDs, duplicate detection
before mount, deduplicated readable logs, and inspection mode.

Prove standalone photo/black export and separation of photo and inspection state.
Future combined-layer checks belong to the deferred orchestrator integration;
they are not missing standalone Frame features to implement during this repair.
Keep source protection, replacement, shortcuts, history, notices and exact 3:4
exports (1200×1600, 2400×3200, 3024×4032). Inspect affected native UI at startup and
minimum sizes. A build/default screenshot alone does not prove config ownership.
Use focused checks; repeat only for relevant changes or concrete uncertainty.
Audit requests authorize inspection/reports, not app edits. Report actual checks
and unknowns honestly. Restructure by keeping what fits, rewriting wrong ownership
and removing superseded implementations after checking callers.

## Always launch the updated app after changes

Every completed set of application changes must end with an app relaunch. After
the relevant checks and review, close any already running instance of the target
app, confirm it has exited, then launch the updated build and leave it running
for the user. Verify the new process/window is alive.
Prefer normal close so cleanup finishes. If it cannot exit, stop only positively
identified target-app processes under the user's authorization to kill the old
instance. Never stop unrelated Electron apps, Chrome, or processes identified only
by a generic name. Do not leave a stale build open or finish with test windows only.

## Commit and push a checkpoint after every completed change

Notes-only tasks are exempt unless the user explicitly requests a checkpoint.

After finishing changes, the relevant checks/review and the affected app's relaunch,
commit and push the completed work as a Git checkpoint. Do not leave completed
work only in the local working folder.

Use the repository rooted at `C:\VSCODE\TIMEMAXX\@APPS`, with Git metadata at
`C:\VSCODE\TIMEMAXX\@APPS\.git`. Run Git from `@APPS`; do not use a parent,
sibling or nested app repository for this checkpoint, or edit `.git` manually.

Inspect status and the intended diff first. Stage only the task's intended source,
config, tests and documentation; preserve unrelated changes. Exclude generated
builds, caches, runtime/session artifacts and credentials. Create a descriptive
commit, then push the current branch to its configured remote/upstream. Do not
force-push, rewrite existing checkpoints or invent a remote destination.

Verify both commit and push succeeded before calling the checkpoint complete.
Report the commit hash and pushed branch. If repository, identity, remote/upstream,
authentication or push conflicts block completion, report the exact blocker;
do not claim the checkpoint was pushed.
