const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// LOGIC — persistence only; renderer owns issue identity, counts and messages.
class DiagnosticLog {
  constructor(directory) {
    this.path = path.join(directory, `layout-${randomUUID()}.json`);
    this.queue = Promise.resolve();
  }

  write(records) {
    const captured = JSON.stringify(records, null, 2);
    const operation = this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.path), { recursive: true });
      await fs.writeFile(this.path, captured, 'utf8');
      return { ok: true, path: this.path };
    });
    this.queue = operation.catch(() => undefined);
    return operation.catch((error) => ({ ok: false, error: error.message }));
  }
}

module.exports = { DiagnosticLog };
