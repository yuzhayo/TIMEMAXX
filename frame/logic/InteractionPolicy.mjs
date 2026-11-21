// LOGIC — one policy for application-owned input; gesture mechanics stay with each input owner.
export const editingSelector = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="slider"],[role="spinbutton"]';
export const keyboardControlSelector = `${editingSelector},button,a[href],[role="button"],[role="menuitem"],[role="option"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"]`;
export const blockingSurfaceSelector = '[role="menu"],[role="listbox"],[role="dialog"],[aria-modal="true"],dialog[open],[data-popover-surface]';

const owns = (element, selector) => Boolean(element?.closest?.(selector));

export function interactionBlocks({ document, target, state, controls = 'editing' }) {
  const selector = controls === 'keyboard' ? keyboardControlSelector : editingSelector;
  return {
    busy: Boolean(state?.busy),
    surface: Boolean(document?.querySelector?.(blockingSurfaceSelector)),
    control: owns(target, selector) || owns(document?.activeElement, selector),
  };
}

export const interactionBlocked = (context) => Object.values(interactionBlocks(context)).some(Boolean);
