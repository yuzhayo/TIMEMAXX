// LOGIC — window-only toggle; Input never edits photo/history/view state.
export function createInputScreenToggle({ transport, reportFailure }) {
  return async (origin) => {
    try {
      const result = await transport.toggleInputScreen();
      if (!result?.ok) throw new Error(result?.error ?? 'Input screen could not toggle');
      return true;
    } catch (error) {
      reportFailure({ code: 'INPUT_SCREEN_TOGGLE_FAILED', operation: 'toggleInputScreen',
        expected: 'opened or closed Input window', error,
        action: 'Input toggle stopped; check ui-control/config.json, screen files and room left of Frame; Frame remains usable' }, origin);
      return false;
    }
  };
}
