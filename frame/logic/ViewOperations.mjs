// LOGIC — view movement/zoom never writes photo transforms, dirty state or Undo history.
export function createViewOperations({ viewState, publish }) {
  return {
    beginViewEdit: () => viewState.beginEdit(),
    isViewEditActive: (gesture) => viewState.isEditActive(gesture),
    updateViewPan: (delta, gesture) => {
      if (!viewState.isEditActive(gesture) || ![delta?.x, delta?.y].every(Number.isFinite)) return;
      publish(viewState.updateEdit({ ...gesture.view, x: gesture.view.x + delta.x, y: gesture.view.y + delta.y }, gesture));
    },
    updateViewWheel: (delta, anchor, gesture, policy) => {
      if (!viewState.isEditActive(gesture) || ![delta, anchor?.x, anchor?.y].every(Number.isFinite)) return;
      const current = viewState.snapshot();
      const settings = viewState.settings;
      const zoom = Math.min(settings.maxZoom, Math.max(settings.minZoom, current.zoom * Math.exp(-delta * policy.viewRate)));
      publish(viewState.updateEdit({ zoom,
        x: current.x + anchor.x * (current.zoom - zoom),
        y: current.y + anchor.y * (current.zoom - zoom),
      }, gesture));
    },
    finishViewEdit: (gesture) => { if (gesture) viewState.finishEdit(gesture.token); },
    cancelViewEdit: (gesture) => publish(viewState.cancelEdit(gesture)),
  };
}
