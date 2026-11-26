export type SaveStatus = 'saving' | 'saved' | 'error';

export type SaveExecutor = (
  valueToSave: string,
  isCurrent: () => boolean
) => Promise<boolean>;

export interface ChecklistSyncOptions {
  normalize?: (value: string | null | undefined) => string;
}

export interface ChecklistSyncState {
  contextKey: string | null;
  draftValue: string;
  lastSavedValue: string;
  isSaving: boolean;
  isDirty: boolean;
}

export interface ChecklistSyncController {
  resetContext: (
    contextKey: string,
    serverValue: string | null | undefined
  ) => { nextValue: string };
  onLocalEdit: (nextValue: string) => void;
  onServerSync: (
    serverValue: string | null | undefined
  ) => { shouldUpdateInput: boolean; nextValue?: string };
  requestSave: (
    value: string,
    saveFn: SaveExecutor,
    onStatusChange?: (status: SaveStatus) => void
  ) => Promise<void>;
  getState: () => ChecklistSyncState;
}

const defaultNormalize = (value: string | null | undefined): string =>
  (value ?? '').replace(/\r\n?/g, '\n');

export function createChecklistSyncController(
  options: ChecklistSyncOptions = {}
): ChecklistSyncController {
  const normalize = options.normalize ?? defaultNormalize;

  let contextKey: string | null = null;
  let generation = 0;
  let lastSavedValue = '';
  let draftValue = '';
  let isSaving = false;
  let queuedValue: string | null = null;
  let activeSavePromise: Promise<void> | null = null;

  const resetContext = (
    nextContextKey: string,
    serverValue: string | null | undefined
  ) => {
    generation += 1;
    contextKey = nextContextKey;
    const normalized = normalize(serverValue);
    lastSavedValue = normalized;
    draftValue = normalized;
    isSaving = false;
    queuedValue = null;
    activeSavePromise = null;
    return { nextValue: normalized };
  };

  const onLocalEdit = (nextValue: string) => {
    draftValue = normalize(nextValue);
  };

  const onServerSync = (serverValue: string | null | undefined) => {
    const normalized = normalize(serverValue);
    const isDirty = draftValue !== lastSavedValue;
    if (isSaving || isDirty) {
      return { shouldUpdateInput: false };
    }
    if (normalized === lastSavedValue && normalized === draftValue) {
      return { shouldUpdateInput: false };
    }
    lastSavedValue = normalized;
    draftValue = normalized;
    return { shouldUpdateInput: true, nextValue: normalized };
  };

  const requestSave = (
    value: string,
    saveFn: SaveExecutor,
    onStatusChange?: (status: SaveStatus) => void
  ): Promise<void> => {
    const normalized = normalize(value);
    const runGeneration = generation;

    if (isSaving) {
      queuedValue = normalized;
      return activeSavePromise ?? Promise.resolve();
    }

    if (normalized === lastSavedValue) {
      return Promise.resolve();
    }

    isSaving = true;
    const isCurrent = () => runGeneration === generation;

    const run = (async () => {
      let nextToSave: string | null = normalized;

      try {
        while (nextToSave !== null) {
          const currentTarget = nextToSave;
          queuedValue = null;

          if (currentTarget === lastSavedValue) {
            nextToSave = queuedValue;
            continue;
          }

          if (isCurrent()) {
            onStatusChange?.('saving');
          }

          let ok = false;
          try {
            ok = await saveFn(currentTarget, isCurrent);
          } catch {
            ok = false;
          }

          if (!isCurrent()) {
            return;
          }

          if (!ok) {
            queuedValue = null;
            onStatusChange?.('error');
            return;
          }

          lastSavedValue = currentTarget;

          if (queuedValue !== null && queuedValue !== lastSavedValue) {
            nextToSave = queuedValue;
          } else {
            queuedValue = null;
            nextToSave = null;
            onStatusChange?.('saved');
          }
        }
      } finally {
        if (isCurrent()) {
          isSaving = false;
          activeSavePromise = null;
        }
      }
    })();

    activeSavePromise = run;
    return run;
  };

  const getState = (): ChecklistSyncState => ({
    contextKey,
    draftValue,
    lastSavedValue,
    isSaving,
    isDirty: draftValue !== lastSavedValue,
  });

  return {
    resetContext,
    onLocalEdit,
    onServerSync,
    requestSave,
    getState,
  };
}
