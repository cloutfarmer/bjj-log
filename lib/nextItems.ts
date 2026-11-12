export interface NextItem {
  text: string;
  done: boolean;
}

const NEXT_LINE = /^next:/i;

/** Parses one "next:" line, or returns null when the line is not one. */
function parseLine(line: string): NextItem | null {
  const trimmed = line.trim();
  if (!NEXT_LINE.test(trimmed)) return null;
  let rest = trimmed.slice(5).trim();
  let done = false;
  if (/^\[x\]/i.test(rest)) {
    done = true;
    rest = rest.slice(3);
  } else if (rest.startsWith("[ ]")) {
    rest = rest.slice(3);
  }
  if (/\(done\)$/i.test(rest.trimEnd())) {
    done = true;
    rest = rest.trimEnd().slice(0, -6);
  }
  return { text: rest.trim(), done };
}

/** Next-time items live in the note text as "next:" lines, so no schema change is needed. */
export function parseNextItems(noteText: string): NextItem[] {
  const items: NextItem[] = [];
  for (const line of noteText.split(/\r?\n/)) {
    const item = parseLine(line);
    if (item && item.text) items.push(item);
  }
  return items;
}

export function stripNextItems(noteText: string): string {
  return noteText
    .split(/\r?\n/)
    .filter((line) => !NEXT_LINE.test(line.trim()))
    .join("\n");
}
