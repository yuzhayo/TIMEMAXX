// LOGIC — app-scoped shortcuts delegate to existing actions; text/menu editing keeps its own keys.
export function attachKeyboardShortcuts(actions, target = window) {
  const document = target.document;
  const onKeyDown = (event) => {
    if (event.defaultPrevented || event.isComposing || !event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (!['s', 'z'].includes(key)) return;
    const editing = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="slider"]';
    if (event.target?.closest?.(editing) || document.activeElement?.closest?.(editing)) return;
    if (document.querySelector('[role="menu"],[role="listbox"],[role="dialog"],[aria-modal="true"],dialog[open],[data-popover-surface]')) return;
    event.preventDefault();
    const state = actions.getSnapshot();
    if (event.repeat || state.busy) return;
    if (key === 's' && state.document && typeof actions.save === 'function') actions.save();
    if (key === 'z' && state.canUndo && typeof actions.undo === 'function') actions.undo();
  };
  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}
