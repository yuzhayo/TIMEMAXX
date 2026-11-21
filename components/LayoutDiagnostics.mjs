// LOGIC — shared issue identity, readable formatting, deduplication and persistence delivery.
export function diagnosticSummary(records) {
  if (!records.length) return '';
  const latest = records.reduce((a, b) => a.lastSeen > b.lastSeen ? a : b);
  const owner = latest.instanceId ?? latest.componentId ?? latest.sectionId ?? 'layout';
  const readable = (value) => {
    if (value === null || value === undefined) return '';
    let encoded;
    try { encoded = typeof value === 'string' ? value : JSON.stringify(value); }
    catch { encoded = String(value); }
    const text = String(encoded ?? value).replace(/\s+/g, ' ').trim();
    return text.length > 180 ? `${text.slice(0, 177)}…` : text;
  };
  const reason = (readable(latest.actual) || `Expected ${readable(latest.expected) || 'the configured operation to succeed'}`).replace(/[.\s]+$/, '');
  const action = (readable(latest.action) || 'details retained for inspection').replace(/[.\s]+$/, '');
  const repeat = latest.repeatCount > 1 ? ` Repeated ${latest.repeatCount}×.` : '';
  return `${records.length} issue${records.length === 1 ? '' : 's'}. Latest ${latest.code} for ${owner}: ${reason}. Action: ${action}.${repeat} Full details are recorded in the local diagnostic log.`;
}

export function createDiagnostics(persist = async () => ({ ok: true })) {
  const records = new Map();
  const listeners = new Set();
  let snapshot = [];
  let delivery = Promise.resolve();
  const refresh = () => {
    snapshot = [...records.values()].map((record) => ({ ...record }));
    for (const listener of listeners) listener();
  };

  const report = (issue) => {
    const detail = {
      code: issue.code,
      operation: issue.operation ?? null,
      componentId: issue.componentId ?? null,
      instanceId: issue.instanceId ?? null,
      sectionId: issue.sectionId ?? null,
      parentId: issue.parentId ?? null,
      filePath: issue.filePath ?? null,
      configPath: issue.configPath ?? null,
      expected: issue.expected ?? null,
      actual: issue.actual ?? null,
      action: issue.action ?? 'component skipped',
    };
    const key = JSON.stringify(detail);
    const previous = records.get(key);
    const now = new Date().toISOString();
    const record = {
      ...detail,
      firstSeen: previous?.firstSeen ?? now,
      lastSeen: now,
      repeatCount: (previous?.repeatCount ?? 0) + 1,
      message: `${detail.instanceId ?? detail.componentId ?? detail.sectionId ?? 'layout'}: ${detail.code}${detail.operation ? ` [${detail.operation}]` : ''} at ${detail.configPath ?? detail.filePath ?? 'catalog'}; expected ${JSON.stringify(detail.expected)}, found ${JSON.stringify(detail.actual)}; ${detail.action}`,
    };
    records.set(key, record);
    refresh();
    const captured = structuredClone(snapshot);
    delivery = delivery.then(async () => {
      try {
        const result = await persist(captured);
        if (result?.ok === false) throw new Error(result.error);
      } catch (error) {
        // Keep one in-memory warning, never recursively try to log a log failure.
        const warning = {
          code: 'LOG_WRITE_FAILED', componentId: null, instanceId: null,
          filePath: null, configPath: null, expected: 'writable local diagnostic log',
          actual: String(error.message), action: 'diagnostics retained in memory',
          firstSeen: now, lastSeen: now, repeatCount: 1,
          message: 'Diagnostic log could not be written; records remain available in memory.',
        };
        records.set('LOG_WRITE_FAILED', warning);
        refresh();
      }
    });
    return record;
  };
  return {
    report,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    flush: () => delivery,
  };
}
