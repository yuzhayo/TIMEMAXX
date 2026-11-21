const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');

// LOGIC — own the persistent image worker and resolve only attributable replies.
class ImageWorker {
  constructor(executable, configPath, workingDirectory) {
    this.nextId = 0;
    this.pending = new Map();
    this.failure = null;
    this.closing = false;
    this.process = spawn(executable, [configPath], { cwd: workingDirectory, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.closed = new Promise((resolve) => this.process.once('close', resolve));
    this.lines = createInterface({ input: this.process.stdout });
    this.lines.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        const pending = this.pending.get(response.id);
        if (!pending || typeof response.ok !== 'boolean') throw new Error('Unattributable image-worker response');
        this.pending.delete(response.id);
        clearTimeout(pending.timer);
        if (response.ok) pending.resolve(response.result);
        else pending.reject(new Error(response.error));
      } catch (error) { this.fail(error); }
    });
    this.process.on('error', (error) => this.fail(error));
    this.process.on('exit', (code) => this.fail(new Error(`Image worker exited (${code})`)));
    this.process.stdin.on('error', (error) => this.fail(error));
    this.process.stderr.on('data', (data) => console.error('[frame image worker]', String(data).trim()));
  }

  fail(error) {
    this.failure ??= error;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(this.failure); }
    this.pending.clear();
  }

  request(command) {
    if (this.failure || this.closing) return Promise.reject(this.failure ?? new Error('Image worker is closing'));
    if (!['load', 'accept_load', 'finalize_load', 'discard_load', 'export'].includes(command.op)) return Promise.reject(new Error('Unsupported image-file operation'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`Image-worker ${command.op} timed out`)), 120000);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(`${JSON.stringify({ id, ...command })}\n`, (error) => { if (error) this.fail(error); });
    });
  }

  async close() {
    this.closing = true;
    this.process.stdin.end();
    await this.closed;
    this.lines.close();
  }
}

module.exports = { ImageWorker };
