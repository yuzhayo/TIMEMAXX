// LOGIC — generic session state for a shell with no configured sections yet.
export function createInputSession(plan, inspection = false) {
  const listeners = new Set();
  let state = { language: plan.initialLanguage, expanded: Object.fromEntries(plan.sections.map((node) => [node.id, node.expanded])), inspection };
  const publish = (next) => { state = next; for (const listener of listeners) listener(); };
  return {
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    setLanguage: (language) => {
      if (!plan.layouts[language] || state.language === language) return false;
      publish({ ...state, language }); return true;
    },
    setExpanded: (id, expanded) => {
      if (!Object.hasOwn(state.expanded, id) || typeof expanded !== 'boolean' || state.expanded[id] === expanded) return false;
      publish({ ...state, expanded: { ...state.expanded, [id]: expanded } }); return true;
    },
    inspect: (inspection) => { if (typeof inspection === 'boolean' && state.inspection !== inspection) publish({ ...state, inspection }); },
    dispose: () => listeners.clear(),
  };
}
