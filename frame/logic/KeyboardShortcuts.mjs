import { interactionBlocks } from './InteractionPolicy.mjs';

// LOGIC — app-scoped shortcuts delegate to existing actions; text/menu editing keeps its own keys.
export function attachKeyboardShortcuts(actions, target = window) {
  const document = target.document;
  const onKeyDown = (event) => {
    if (event.defaultPrevented || event.isComposing || !event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (!['s', 'z'].includes(key)) return;
    const state = actions.getSnapshot();
    const blocked = interactionBlocks({ document, target: event.target, state });
    if (blocked.control || blocked.surface) return;
    event.preventDefault();
    if (event.repeat || blocked.busy) return;
    if (key === 's' && state.document && typeof actions.save === 'function') actions.save();
    if (key === 'z' && state.canUndo && typeof actions.undo === 'function') actions.undo();
  };
  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}
