import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseChecklist,
  serializeChecklist,
  normalizeChecklistValue,
  hasChecklistItems,
  parsePastedChecklist,
  splicePastedTasks,
} from './checklist.ts';

const seqIds = () => {
  let n = 0;
  return () => `id-${++n}`;
};

test('parseChecklist and serializeChecklist handle empty, checked, unchecked, and legacy lines', () => {
  const makeId = seqIds();
  assert.deepEqual(parseChecklist('', makeId), [
    { id: 'id-1', text: '', checked: false },
  ]);

  const parsed = parseChecklist('- [x] Done\r\n- [X] Also done\n- [ ] Todo\n- Legacy\nPlain', seqIds());
  assert.deepEqual(parsed, [
    { id: 'id-1', text: 'Done', checked: true },
    { id: 'id-2', text: 'Also done', checked: true },
    { id: 'id-3', text: 'Todo', checked: false },
    { id: 'id-4', text: 'Legacy', checked: false },
    { id: 'id-5', text: 'Plain', checked: false },
  ]);

  assert.equal(
    serializeChecklist([
      { id: '1', text: 'Done', checked: true },
      { id: '2', text: '   ', checked: false },
      { id: '3', text: 'Todo', checked: false },
    ]),
    '- [x] Done\n- [ ] Todo'
  );

  assert.equal(serializeChecklist([{ id: '1', text: '  ', checked: false }]), '');
  assert.equal(normalizeChecklistValue('- Legacy\r\n- [X] Done\n\n'), '- [ ] Legacy\n- [x] Done');
  assert.equal(normalizeChecklistValue(null), '');
  assert.equal(hasChecklistItems(''), false);
  assert.equal(hasChecklistItems('- [ ]   '), false);
  assert.equal(hasChecklistItems('- [ ] Real task'), true);
});

test('parsePastedChecklist does not intercept plain single-line text', () => {
  const result = parsePastedChecklist('hello world', seqIds());
  assert.equal(result.shouldIntercept, false);
  assert.deepEqual(result.items, []);
});

test('parsePastedChecklist intercepts single-line checklist or bullet items and preserves checked state', () => {
  assert.deepEqual(parsePastedChecklist('- [x] Done task', seqIds()), {
    shouldIntercept: true,
    items: [{ id: 'id-1', text: 'Done task', checked: true }],
  });

  assert.deepEqual(parsePastedChecklist('- [X] Upper done', seqIds()), {
    shouldIntercept: true,
    items: [{ id: 'id-1', text: 'Upper done', checked: true }],
  });

  assert.deepEqual(parsePastedChecklist('- [ ] Todo task', seqIds()), {
    shouldIntercept: true,
    items: [{ id: 'id-1', text: 'Todo task', checked: false }],
  });

  assert.deepEqual(parsePastedChecklist('- Bullet', seqIds()), {
    shouldIntercept: true,
    items: [{ id: 'id-1', text: 'Bullet', checked: false }],
  });

  assert.deepEqual(parsePastedChecklist('* Star', seqIds()), {
    shouldIntercept: true,
    items: [{ id: 'id-1', text: 'Star', checked: false }],
  });

  assert.deepEqual(parsePastedChecklist('• Dot', seqIds()), {
    shouldIntercept: true,
    items: [{ id: 'id-1', text: 'Dot', checked: false }],
  });
});

test('parsePastedChecklist handles multi-line plain text and markdown checklists while ignoring blank lines', () => {
  assert.deepEqual(parsePastedChecklist('Task 1\nTask 2\r\n\nTask 3', seqIds()), {
    shouldIntercept: true,
    items: [
      { id: 'id-1', text: 'Task 1', checked: false },
      { id: 'id-2', text: 'Task 2', checked: false },
      { id: 'id-3', text: 'Task 3', checked: false },
    ],
  });

  assert.deepEqual(parsePastedChecklist('- [x] Done\n- [ ] Todo', seqIds()), {
    shouldIntercept: true,
    items: [
      { id: 'id-1', text: 'Done', checked: true },
      { id: 'id-2', text: 'Todo', checked: false },
    ],
  });

  assert.deepEqual(parsePastedChecklist('\n  \n', seqIds()), {
    shouldIntercept: true,
    items: [],
  });
});

test('splicePastedTasks replaces an empty row or fully selected row', () => {
  const emptyItems = [{ id: 'a', text: '', checked: false }];
  const pasted = [
    { id: 'p1', text: 'First', checked: true },
    { id: 'p2', text: 'Second', checked: false },
  ];

  const fromEmpty = splicePastedTasks({
    items: emptyItems,
    index: 0,
    selectionStart: 0,
    selectionEnd: 0,
    pastedItems: pasted,
  });
  assert.deepEqual(fromEmpty, {
    items: pasted,
    focusIndex: 1,
    caretOffset: 'Second'.length,
  });

  const fullSelected = splicePastedTasks({
    items: [
      { id: 'a', text: 'Keep', checked: false },
      { id: 'b', text: 'Replace me', checked: true },
      { id: 'c', text: 'After', checked: false },
    ],
    index: 1,
    selectionStart: 0,
    selectionEnd: 'Replace me'.length,
    pastedItems: pasted,
  });
  assert.deepEqual(fullSelected, {
    items: [
      { id: 'a', text: 'Keep', checked: false },
      ...pasted,
      { id: 'c', text: 'After', checked: false },
    ],
    focusIndex: 2,
    caretOffset: 'Second'.length,
  });
});

test('splicePastedTasks splits mid-line text across pasted lines and focuses end of last pasted text', () => {
  const result = splicePastedTasks({
    items: [{ id: 'a', text: 'StartEnd', checked: true }],
    index: 0,
    selectionStart: 5,
    selectionEnd: 5,
    pastedItems: [
      { id: 'p1', text: 'One', checked: false },
      { id: 'p2', text: 'Two', checked: true },
      { id: 'p3', text: 'Three', checked: false },
    ],
  });

  assert.deepEqual(result, {
    items: [
      { id: 'a', text: 'StartOne', checked: true },
      { id: 'p2', text: 'Two', checked: true },
      { id: 'p3', text: 'ThreeEnd', checked: false },
    ],
    focusIndex: 2,
    caretOffset: 'Three'.length,
  });

  const singleLineIntoMid = splicePastedTasks({
    items: [{ id: 'a', text: 'Hello World', checked: false }],
    index: 0,
    selectionStart: 6,
    selectionEnd: 11,
    pastedItems: [{ id: 'p1', text: 'DailyPulse', checked: true }],
  });
  assert.deepEqual(singleLineIntoMid, {
    items: [{ id: 'a', text: 'Hello DailyPulse', checked: false }],
    focusIndex: 0,
    caretOffset: 'Hello DailyPulse'.length,
  });
});

test('splicePastedTasks supports replaceAll and ignores empty pastedItems', () => {
  const original = [
    { id: 'a', text: 'Old 1', checked: false },
    { id: 'b', text: 'Old 2', checked: true },
  ];
  const pasted = [{ id: 'p1', text: 'New 1', checked: true }];

  assert.deepEqual(
    splicePastedTasks({
      items: original,
      index: 0,
      selectionStart: 0,
      selectionEnd: 0,
      pastedItems: pasted,
      replaceAll: true,
    }),
    {
      items: pasted,
      focusIndex: 0,
      caretOffset: 'New 1'.length,
    }
  );

  assert.deepEqual(
    splicePastedTasks({
      items: original,
      index: 1,
      selectionStart: 2,
      selectionEnd: 2,
      pastedItems: [],
    }),
    {
      items: original,
      focusIndex: 1,
      caretOffset: 2,
    }
  );
});
