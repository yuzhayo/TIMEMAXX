// LOGIC — launch-only command; opening Input never edits photo/history/view state.
export function createInputScreenAction({ transport, reportFailure }) {
  return async (origin) => {
    try {
      const result = await transport.openInputScreen();
      if (!result?.ok) throw new Error(result?.error ?? 'Input screen could not open');
      return true;
    } catch (error) {
      reportFailure({ code: 'INPUT_SCREEN_OPEN_FAILED', operation: 'openInputScreen',
        expected: 'opened or focused Input window', error,
        action: 'Input screen not opened; check ui-control/config.json and screen files; Frame remains usable' }, origin);
      return false;
    }
  };
}
