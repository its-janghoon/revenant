// Maps Kiro CLI `--output-format stream-json` (V3, ACP payloads) to runner events.

export type KiroEvent =
  | { type: 'text'; text: string }
  | { type: 'tool' }
  | { type: 'done' }
  | { type: 'file'; path: string; op: 'add' | 'edit' | 'delete' }
  | { type: 'credits'; used: number }
  | { type: 'end'; status: string };

type Json = Record<string, unknown>;

const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// Repo-relative path, or null when the file is outside the repo.
export function rel(path: string, root: string): string | null {
  let p = path.startsWith('file://') ? decodeURIComponent(path.slice('file://'.length)) : path;
  if (!p.startsWith('/')) return p.replace(/^\.\//, '');
  const base = root.endsWith('/') ? root : `${root}/`;
  if (!p.startsWith(base)) return null;
  p = p.slice(base.length);
  return p || null;
}

export function read(line: string, root: string): KiroEvent[] {
  let j: Json;
  try {
    j = obj(JSON.parse(line));
  } catch {
    return [];
  }
  if (j.type === 'runFinished') return [{ type: 'end', status: String(obj(j.data).status ?? 'unknown') }];
  if (j.type !== 'sessionUpdate') return [];

  const u = obj(obj(j.data).update);
  switch (u.sessionUpdate) {
    case 'agent_message_chunk': {
      const c = obj(u.content);
      return c.type === 'text' && typeof c.text === 'string' ? [{ type: 'text', text: c.text }] : [];
    }
    case 'tool_call':
      return [{ type: 'tool' }];
    case 'tool_call_update': {
      if (u.status !== 'completed' && u.status !== 'failed') return [];
      const out: KiroEvent[] = [];
      for (const c of list(u.content).map(obj)) {
        if (c.type !== 'diff' || typeof c.path !== 'string') continue;
        const path = rel(c.path, root);
        if (!path) continue;
        const op = !c.oldText ? 'add' : c.newText === '' || c.newText == null ? 'delete' : 'edit';
        out.push({ type: 'file', path, op });
      }
      out.push({ type: 'done' });
      return out;
    }
    case 'session_info_update': {
      const k = obj(obj(u._meta).kiro);
      if (k.kind !== 'session_usage') return [];
      const used = list(k.credits)
        .map(obj)
        .filter((c) => c.unit === 'credit' && typeof c.usage === 'number')
        .reduce((sum, c) => sum + (c.usage as number), 0);
      return [{ type: 'credits', used }];
    }
    default:
      return [];
  }
}
