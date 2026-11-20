// LOGIC — immutable document edits and one owner for Undo/Redo.
export class PhotoHistory {
  constructor(initial, limit) {
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new Error('history.limit must be positive, or null to explicitly disable tracking');
    this.limit = limit;
    this.current = structuredClone(initial);
    this.past = [];
    this.future = [];
    this.editing = false;
    this.beforeEdit = null;
    this.editSequence = 0;
    this.editToken = null;
  }

  commit(next) {
    const finished = this.finishEdit();
    if (JSON.stringify(next) === JSON.stringify(this.current)) return finished;
    if (this.limit !== null) {
      this.past.push(structuredClone(this.current));
      if (this.past.length > this.limit) this.past.shift();
    }
    this.current = structuredClone(next);
    this.future = [];
    return true;
  }

  reset(initial) {
    this.current = structuredClone(initial);
    this.past = [];
    this.future = [];
    this.editing = false;
    this.beforeEdit = null;
    this.editToken = null;
  }

  beginEdit() {
    if (this.editing) return this.editToken;
    this.editing = true;
    this.beforeEdit = structuredClone(this.current);
    this.editToken = ++this.editSequence;
    return this.editToken;
  }

  isEditActive(token) { return this.editing && token === this.editToken; }

  updateEdit(next, token) {
    if (token !== undefined && !this.isEditActive(token)) return false;
    this.beginEdit();
    if (JSON.stringify(next) === JSON.stringify(this.current)) return false;
    this.current = structuredClone(next);
    return true;
  }

  finishEdit(token) {
    if (token !== undefined && !this.isEditActive(token)) return false;
    if (!this.editing) return false;
    const before = this.beforeEdit;
    this.editing = false;
    this.beforeEdit = null;
    this.editToken = null;
    if (JSON.stringify(before) === JSON.stringify(this.current)) return false;
    if (this.limit !== null) {
      this.past.push(before);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future = [];
    return true;
  }

  cancelEdit(token) {
    if (token !== undefined && !this.isEditActive(token)) return false;
    if (!this.editing) return false;
    const changed = JSON.stringify(this.beforeEdit) !== JSON.stringify(this.current);
    this.current = this.beforeEdit;
    this.editing = false;
    this.beforeEdit = null;
    this.editToken = null;
    return changed;
  }

  undo() {
    const finished = this.finishEdit();
    if (!this.past.length) return finished;
    this.future.push(this.current);
    this.current = this.past.pop();
    return true;
  }

  redo() {
    const finished = this.finishEdit();
    if (!this.future.length) return finished;
    this.past.push(this.current);
    this.current = this.future.pop();
    return true;
  }

  snapshot() {
    const pending = this.editing && JSON.stringify(this.beforeEdit) !== JSON.stringify(this.current);
    return { document: structuredClone(this.current), canUndo: this.limit !== null && (this.past.length > 0 || pending), canRedo: !pending && this.future.length > 0 };
  }
}
