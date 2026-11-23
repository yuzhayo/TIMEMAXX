// LOGIC — one copy operation shared by value-box owners. The async Clipboard
// API is preferred; the selected-text fallback keeps copy working when the
// platform denies the async permission.
export async function copyText(value, element) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    if (!element) return;
    element.focus?.();
    element.select?.();
    document.execCommand('copy');
  }
}
