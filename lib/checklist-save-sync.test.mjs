import test from 'node:test';
import assert from 'node:assert/strict';

import { createChecklistSyncController } from './checklist-save-sync.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('typing during an in-flight save is not overwritten by save response or delayed Realtime echo', async () => {
  const controller = createChecklistSyncController();
  controller.resetContext('user1:2026-11-26', '- [ ] Task 1');

  const d1 = deferred();
  const statuses = [];
  const savePromise = controller.requestSave(
    '- [ ] Task 1',
    async () => {
      // Simulate requestSave skipping? Wait: '- [ ] Task 1' is already saved,
      // so let's edit first to trigger a real in-flight save.
      return await d1.promise;
    },
    (s) => statuses.push(s)
  );
  await savePromise;
  assert.deepEqual(statuses, []);

  // Real edit -> Enter triggers save of "- [ ] Task 1" while user keeps typing "- [ ] Task 2"
  controller.resetContext('user1:2026-11-26', '');
  controller.onLocalEdit('- [ ] Task 1');
  const d2 = deferred();
  const inFlight = controller.requestSave(
    '- [ ] Task 1',
    async () => await d2.promise,
    (s) => statuses.push(s)
  );

  // User types Task 2 while save is still in-flight
  controller.onLocalEdit('- [ ] Task 1\n- [ ] Task 2');
  assert.equal(controller.getState().isDirty, true);

  // Save resolves with "- [ ] Task 1"
  d2.resolve(true);
  await inFlight;

  // Immediate onLogUpsert + delayed Realtime echo arrive with "- [ ] Task 1"
  assert.deepEqual(controller.onServerSync('- [ ] Task 1'), { shouldUpdateInput: false });
  assert.deepEqual(controller.onServerSync('- [ ] Task 1'), { shouldUpdateInput: false });
  assert.equal(controller.getState().draftValue, '- [ ] Task 1\n- [ ] Task 2');
  assert.equal(controller.getState().isDirty, true);

  // Subsequent save of Task 1 + Task 2 completes -> becomes clean
  const d3 = deferred();
  const secondSave = controller.requestSave(
    '- [ ] Task 1\n- [ ] Task 2',
    async () => await d3.promise,
    (s) => statuses.push(s)
  );
  d3.resolve(true);
  await secondSave;

  assert.equal(controller.getState().isDirty, false);
  assert.deepEqual(controller.onServerSync('- [x] Task 1\n- [ ] Task 2'), {
    shouldUpdateInput: true,
    nextValue: '- [x] Task 1\n- [ ] Task 2',
  });
});

test('overlapping saves are serialized and coalesced to the latest value', async () => {
  const controller = createChecklistSyncController();
  controller.resetContext('user1:2026-11-26', '');

  const calls = [];
  const gates = [deferred(), deferred()];
  let activeCount = 0;
  let maxActive = 0;

  const saveFn = async (val) => {
    activeCount++;
    maxActive = Math.max(maxActive, activeCount);
    const idx = calls.length;
    calls.push(val);
    const ok = await gates[idx].promise;
    activeCount--;
    return ok;
  };

  controller.onLocalEdit('- [ ] A');
  const p1 = controller.requestSave('- [ ] A', saveFn);

  // While save #1 is in-flight, user makes two more edits/saves
  controller.onLocalEdit('- [ ] A\n- [ ] B');
  const p2 = controller.requestSave('- [ ] A\n- [ ] B', saveFn);

  controller.onLocalEdit('- [ ] A\n- [ ] B\n- [ ] C');
  const p3 = controller.requestSave('- [ ] A\n- [ ] B\n- [ ] C', saveFn);

  assert.equal(calls.length, 1);
  assert.equal(calls[0], '- [ ] A');

  gates[0].resolve(true);
  // Wait a microtask for queued save to start
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(calls.length, 2);
  assert.equal(calls[1], '- [ ] A\n- [ ] B\n- [ ] C');

  gates[1].resolve(true);
  await Promise.all([p1, p2, p3]);

  assert.equal(maxActive, 1);
  assert.equal(controller.getState().isSaving, false);
  assert.equal(controller.getState().lastSavedValue, '- [ ] A\n- [ ] B\n- [ ] C');
  assert.equal(controller.getState().isDirty, false);
});

test('reverting to previously saved value during an in-flight save still flushes the revert', async () => {
  const controller = createChecklistSyncController();
  controller.resetContext('user1:2026-11-26', '- [ ] A');

  const calls = [];
  const gates = [deferred(), deferred()];
  const saveFn = async (val) => {
    const idx = calls.length;
    calls.push(val);
    return await gates[idx].promise;
  };

  controller.onLocalEdit('- [ ] A\n- [ ] B');
  const p1 = controller.requestSave('- [ ] A\n- [ ] B', saveFn);

  // User reverts back to "- [ ] A" while "- [ ] A\n- [ ] B" is still in-flight
  controller.onLocalEdit('- [ ] A');
  const p2 = controller.requestSave('- [ ] A', saveFn);

  gates[0].resolve(true);
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(calls, ['- [ ] A\n- [ ] B', '- [ ] A']);
  gates[1].resolve(true);
  await Promise.all([p1, p2]);
  assert.equal(controller.getState().lastSavedValue, '- [ ] A');
});

test('context switch during an in-flight save ignores stale resolution and status updates', async () => {
  const controller = createChecklistSyncController();
  controller.resetContext('user1:2026-11-26', '- [ ] Day 1');

  const d1 = deferred();
  const statuses = [];
  let isCurrentAtCompletion = null;

  controller.onLocalEdit('- [ ] Day 1 updated');
  const p1 = controller.requestSave(
    '- [ ] Day 1 updated',
    async (_val, isCurrent) => {
      const ok = await d1.promise;
      isCurrentAtCompletion = isCurrent();
      return ok;
    },
    (s) => statuses.push(s)
  );

  assert.deepEqual(statuses, ['saving']);

  // User switches to another date before the save resolves
  const reset = controller.resetContext('user1:2026-11-25', '- [ ] Day 2');
  assert.equal(reset.nextValue, '- [ ] Day 2');
  assert.equal(controller.getState().isSaving, false);
  assert.equal(controller.getState().lastSavedValue, '- [ ] Day 2');

  d1.resolve(true);
  await p1;

  assert.equal(isCurrentAtCompletion, false);
  // Stale save did NOT emit 'saved' or overwrite the new context
  assert.deepEqual(statuses, ['saving']);
  assert.equal(controller.getState().draftValue, '- [ ] Day 2');
  assert.equal(controller.getState().lastSavedValue, '- [ ] Day 2');
});

test('save failure emits error status and preserves dirty local draft', async () => {
  const controller = createChecklistSyncController();
  controller.resetContext('user1:2026-11-26', '- [ ] Old');

  const statuses = [];
  controller.onLocalEdit('- [ ] New unsaved');
  await controller.requestSave(
    '- [ ] New unsaved',
    async () => false,
    (s) => statuses.push(s)
  );

  assert.deepEqual(statuses, ['saving', 'error']);
  assert.equal(controller.getState().isDirty, true);
  assert.equal(controller.getState().lastSavedValue, '- [ ] Old');
  assert.deepEqual(controller.onServerSync('- [ ] Old'), { shouldUpdateInput: false });
});
