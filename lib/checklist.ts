export interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface ParsedPasteResult {
  shouldIntercept: boolean;
  items: TaskItem[];
}

export interface SplicePasteParams {
  items: TaskItem[];
  index: number;
  selectionStart: number;
  selectionEnd: number;
  pastedItems: TaskItem[];
  replaceAll?: boolean;
}

export interface SplicePasteResult {
  items: TaskItem[];
  focusIndex: number;
  caretOffset: number;
}

export function createTaskId(): string {
  return Math.random().toString(36).slice(2);
}

function parseLine(line: string, makeId: () => string): TaskItem {
  let checked = false;
  let content = line;

  if (content.startsWith('- [x] ') || content.startsWith('- [X] ')) {
    checked = true;
    content = content.slice(6);
  } else if (content.startsWith('- [ ] ')) {
    checked = false;
    content = content.slice(6);
  } else if (content.startsWith('- ')) {
    checked = false;
    content = content.slice(2);
  }

  return {
    id: makeId(),
    text: content,
    checked,
  };
}

export function parseChecklist(text: string, makeId: () => string = createTaskId): TaskItem[] {
  if (!text) return [{ id: makeId(), text: '', checked: false }];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return lines.map((line) => parseLine(line, makeId));
}

export function serializeChecklist(items: TaskItem[]): string {
  const meaningfulItems = items.filter((item) => item.text.trim());

  if (meaningfulItems.length === 0) {
    return '';
  }

  return meaningfulItems
    .map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
    .join('\n');
}

export function normalizeChecklistValue(text: string | null | undefined): string {
  return serializeChecklist(parseChecklist(text ?? ''));
}

export function hasChecklistItems(text: string | null | undefined): boolean {
  return parseChecklist(text ?? '').some((item) => item.text.trim() !== '');
}

const BULLET_OR_CHECKBOX_RE = /^\s*(?:-\s+\[([xX ])\]\s+|[-*•]\s+)(.*)$/;

function parsePastedLine(line: string, makeId: () => string): TaskItem {
  const match = line.match(BULLET_OR_CHECKBOX_RE);
  if (match) {
    const marker = match[1];
    return {
      id: makeId(),
      text: match[2],
      checked: marker === 'x' || marker === 'X',
    };
  }

  return {
    id: makeId(),
    text: line.trim(),
    checked: false,
  };
}

export function parsePastedChecklist(
  rawText: string,
  makeId: () => string = createTaskId
): ParsedPasteResult {
  const normalized = rawText.replace(/\r\n?/g, '\n');
  const hasNewline = normalized.includes('\n');
  const isSingleLineBullet = !hasNewline && BULLET_OR_CHECKBOX_RE.test(normalized);

  if (!hasNewline && !isSingleLineBullet) {
    return { shouldIntercept: false, items: [] };
  }

  const lines = normalized.split('\n').filter((line) => line.trim() !== '');
  return {
    shouldIntercept: true,
    items: lines.map((line) => parsePastedLine(line, makeId)),
  };
}

export function splicePastedTasks({
  items,
  index,
  selectionStart,
  selectionEnd,
  pastedItems,
  replaceAll = false,
}: SplicePasteParams): SplicePasteResult {
  if (pastedItems.length === 0) {
    return {
      items,
      focusIndex: index,
      caretOffset: selectionEnd,
    };
  }

  if (replaceAll) {
    const nextItems = pastedItems.map((item) => ({ ...item }));
    const focusIndex = nextItems.length - 1;
    return {
      items: nextItems,
      focusIndex,
      caretOffset: nextItems[focusIndex].text.length,
    };
  }

  const current = items[index];
  if (!current) {
    return {
      items,
      focusIndex: Math.max(0, items.length - 1),
      caretOffset: 0,
    };
  }

  const start = Math.max(0, Math.min(selectionStart, current.text.length));
  const end = Math.max(start, Math.min(selectionEnd, current.text.length));
  const isRowEmpty = current.text === '';
  const isFullRowSelected = start === 0 && end === current.text.length;

  if (isRowEmpty || isFullRowSelected) {
    const inserted = pastedItems.map((item) => ({ ...item }));
    const nextItems = [
      ...items.slice(0, index),
      ...inserted,
      ...items.slice(index + 1),
    ];
    const focusIndex = index + inserted.length - 1;
    return {
      items: nextItems,
      focusIndex,
      caretOffset: inserted[inserted.length - 1].text.length,
    };
  }

  const before = current.text.slice(0, start);
  const after = current.text.slice(end);
  const first = pastedItems[0];

  if (pastedItems.length === 1) {
    const mergedText = `${before}${first.text}${after}`;
    const nextItems = items.map((item, i) =>
      i === index ? { ...item, text: mergedText } : item
    );
    return {
      items: nextItems,
      focusIndex: index,
      caretOffset: before.length + first.text.length,
    };
  }

  const last = pastedItems[pastedItems.length - 1];
  const middle = pastedItems.slice(1, -1).map((item) => ({ ...item }));
  const firstItem: TaskItem = {
    ...current,
    text: `${before}${first.text}`,
  };
  const lastItem: TaskItem = {
    ...last,
    text: `${last.text}${after}`,
  };
  const inserted = [firstItem, ...middle, lastItem];
  const nextItems = [
    ...items.slice(0, index),
    ...inserted,
    ...items.slice(index + 1),
  ];
  const focusIndex = index + inserted.length - 1;

  return {
    items: nextItems,
    focusIndex,
    caretOffset: last.text.length,
  };
}
