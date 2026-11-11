// Reads the checklist in a Kiro spec's tasks.md.
// `- [ ] 1. Title` todo, `- [-] 1. Title` doing, `- [x] 1. Title` done. Subtasks: `1.2`.

export type State = 'todo' | 'doing' | 'done';
export type Task = { number: string; title: string; state: State };

const LINE = /^\s*[-*] \[([ xX-])\]\s+(\d+(?:\.\d+)*)\.?\s+(.+?)\s*$/;

export function parse(md: string): Task[] {
  const out: Task[] = [];
  for (const line of md.split('\n')) {
    const m = LINE.exec(line);
    if (!m) continue;
    const mark = m[1];
    const state: State = mark === '-' ? 'doing' : mark === ' ' ? 'todo' : 'done';
    out.push({ number: m[2], title: m[3], state });
  }
  return out;
}

// Tasks that left `todo` since `before` (started, or finished without being marked doing).
export function started(before: Task[], after: Task[]): Task[] {
  const prev = new Map(before.map((t) => [t.number, t.state]));
  return after.filter((t) => t.state !== 'todo' && (prev.get(t.number) ?? 'todo') === 'todo');
}

// `task 3: title` or `task 3.1 - title` in a commit subject.
export function committed(subject: string): { number: string; title: string } | null {
  const m = /^task\s+(\d+(?:\.\d+)*)\s*[:.\-–]?\s*(.*)$/i.exec(subject.trim());
  return m ? { number: m[1], title: m[2] } : null;
}
