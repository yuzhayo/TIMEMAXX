// LOGIC — window operations and native state are independent of file/history availability.
export function createWindowActions({ transport, initialState, publish, diagnostics }) {
  let state = initialState;
  const unsubscribe = transport.onWindowState((next) => {
    if (typeof next?.maximized !== 'boolean' || typeof next?.minimized !== 'boolean' || typeof next?.verticalMaximized !== 'boolean') {
      diagnostics?.report({ code: 'INVALID_WINDOW_STATE', filePath: 'logic/WindowActions.mjs', expected: 'native maximized/minimized/verticalMaximized booleans', actual: next, action: 'invalid state ignored' });
      return;
    }
    state = { maximized: next.maximized, minimized: next.minimized, verticalMaximized: next.verticalMaximized };
    publish();
  });
  return {
    snapshot: () => state,
    activate: async (operation, origin) => {
      try {
        const response = await transport.windowAction(operation);
        if (!response.ok) throw new Error(response.error);
      } catch (error) {
        diagnostics?.report({ code: 'WINDOW_ACTION_FAILED', operation,
          componentId: origin?.componentId, instanceId: origin?.instanceId, parentId: origin?.parentId,
          filePath: origin?.filePath ?? 'logic/WindowActions.mjs', configPath: origin?.configPath,
          expected: 'successful native window operation', actual: error.message, action: 'window action stopped' });
      }
    },
    dispose: unsubscribe,
  };
}
