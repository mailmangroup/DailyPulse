import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type TaskItem,
  createTaskId,
  parseChecklist,
  serializeChecklist,
  hasChecklistItems,
  normalizeChecklistValue,
  parsePastedChecklist,
  splicePastedTasks,
} from '@/lib/checklist';

export { type TaskItem, parseChecklist, serializeChecklist, hasChecklistItems };

interface ChecklistEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ChecklistEditor({ value, onChange, onSave, placeholder, className }: ChecklistEditorProps) {
  const [items, setItems] = useState<TaskItem[]>(() => parseChecklist(value));
  const [allSelected, setAllSelected] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputsRef = useRef<(HTMLTextAreaElement | null)[]>([]);
  const isComposing = useRef(false);
  const lastNotifiedValue = useRef<string>(normalizeChecklistValue(value));
  const latestSerializedValue = useRef<string>(normalizeChecklistValue(value));

  const resizeTextarea = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    inputsRef.current.length = items.length;
    inputsRef.current.forEach(resizeTextarea);
  }, [items, resizeTextarea]);

  // Sync state if external value changes completely (e.g. user switch)
  useEffect(() => {
    const incomingSerialized = normalizeChecklistValue(value);
    if (incomingSerialized !== lastNotifiedValue.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(parseChecklist(value));
      setAllSelected(false);
      lastNotifiedValue.current = incomingSerialized;
      latestSerializedValue.current = incomingSerialized;
    }
  }, [value]);

  const updateItems = useCallback((newItems: TaskItem[]) => {
    setItems(newItems);
    const serialized = serializeChecklist(newItems);
    lastNotifiedValue.current = serialized;
    latestSerializedValue.current = serialized;
    onChange(serialized);
  }, [onChange]);

  const focusRowAt = useCallback((targetIndex: number, caretOffset?: number) => {
    setTimeout(() => {
      const input = inputsRef.current[targetIndex];
      if (!input) return;
      input.focus();
      const offset = caretOffset ?? input.value.length;
      input.selectionStart = offset;
      input.selectionEnd = offset;
    }, 0);
  }, []);

  const clearAllTasks = useCallback(() => {
    const empty: TaskItem[] = [{ id: createTaskId(), text: '', checked: false }];
    setAllSelected(false);
    updateItems(empty);
    onSave('');
    focusRowAt(0, 0);
  }, [updateItems, onSave, focusRowAt]);

  const handleItemChange = (index: number, text: string) => {
    const newItems = items.map((item, i) => (i === index ? { ...item, text } : item));
    updateItems(newItems);
  };

  const handleItemToggle = (index: number) => {
    const newItems = items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    setAllSelected(false);
    updateItems(newItems);
    // Auto-save on toggle
    onSave(serializeChecklist(newItems));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposing.current) return;

    const isMod = e.metaKey || e.ctrlKey;
    const keyLower = e.key.toLowerCase();

    if (isMod && keyLower === 'a' && !e.altKey && !e.shiftKey) {
      if (allSelected) {
        e.preventDefault();
        return;
      }
      const el = e.currentTarget;
      const hasContent = items.length > 1 || items.some((i) => i.text.trim() !== '');
      if (hasContent && el.selectionStart === 0 && el.selectionEnd === el.value.length) {
        e.preventDefault();
        setAllSelected(true);
        return;
      }
    }

    if (allSelected) {
      if (isMod && keyLower === 'c' && !e.altKey) {
        e.preventDefault();
        const serialized = serializeChecklist(items);
        if (serialized) {
          void navigator.clipboard?.writeText(serialized).catch(() => {});
        }
        return;
      }
      if (isMod && keyLower === 'x' && !e.altKey) {
        e.preventDefault();
        const serialized = serializeChecklist(items);
        if (serialized) {
          void navigator.clipboard?.writeText(serialized).catch(() => {});
        }
        clearAllTasks();
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        clearAllTasks();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAllSelected(false);
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setAllSelected(false);
      } else if (isMod && keyLower === 'v') {
        // Let onPaste handle full replacement.
        return;
      } else if (!isMod && !e.altKey && e.key.length === 1) {
        e.preventDefault();
        const next: TaskItem[] = [{ id: createTaskId(), text: e.key, checked: false }];
        setAllSelected(false);
        updateItems(next);
        focusRowAt(0, 1);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      setAllSelected(false);
      const newItems = [...items];
      newItems.splice(index + 1, 0, { id: createTaskId(), text: '', checked: false });
      updateItems(newItems);
      onSave(serializeChecklist(newItems));
      focusRowAt(index + 1, 0);
    } else if (e.key === 'Backspace' && items[index].text === '') {
      e.preventDefault();
      if (items.length > 1) {
        const newItems = [...items];
        newItems.splice(index, 1);
        updateItems(newItems);
        onSave(serializeChecklist(newItems));
        const prevIndex = index > 0 ? index - 1 : 0;
        focusRowAt(prevIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (index < items.length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
    }
  };

  const handleCopy = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!allSelected) return;
    e.preventDefault();
    const serialized = serializeChecklist(items);
    if (serialized) {
      e.clipboardData.setData('text/plain', serialized);
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const rawText = e.clipboardData.getData('text/plain');
    if (!rawText) return;

    const parsed = parsePastedChecklist(rawText);

    if (allSelected) {
      e.preventDefault();
      const pastedItems = parsed.shouldIntercept
        ? parsed.items
        : rawText.trim()
          ? [{ id: createTaskId(), text: rawText, checked: false }]
          : [];
      if (pastedItems.length === 0) return;

      const result = splicePastedTasks({
        items,
        index,
        selectionStart: 0,
        selectionEnd: 0,
        pastedItems,
        replaceAll: true,
      });
      setAllSelected(false);
      updateItems(result.items);
      onSave(serializeChecklist(result.items));
      focusRowAt(result.focusIndex, result.caretOffset);
      return;
    }

    if (!parsed.shouldIntercept) return;

    e.preventDefault();
    if (parsed.items.length === 0) return;

    const result = splicePastedTasks({
      items,
      index,
      selectionStart: e.currentTarget.selectionStart,
      selectionEnd: e.currentTarget.selectionEnd,
      pastedItems: parsed.items,
    });
    updateItems(result.items);
    onSave(serializeChecklist(result.items));
    focusRowAt(result.focusIndex, result.caretOffset);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (isComposing.current) return;
    if (rootRef.current?.contains(e.relatedTarget as Node | null)) return;
    setAllSelected(false);
    onSave(latestSerializedValue.current);
  };

  return (
    <div ref={rootRef} className={cn("flex flex-col gap-0.5", className)}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-2 group rounded px-1 -mx-1 transition-colors",
            allSelected && "bg-primary/15"
          )}
        >
          <button
            type="button"
            onClick={() => handleItemToggle(index)}
            className="mt-[2px] shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
          >
            {item.checked ? (
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Square className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
          <textarea
            ref={(el) => {
              inputsRef.current[index] = el;
              resizeTextarea(el);
            }}
            className={cn(
              "flex-1 resize-none overflow-hidden bg-transparent px-0 py-0 text-xs leading-[1.1rem] outline-none placeholder:text-muted-foreground/60 min-w-0",
              item.checked && "text-muted-foreground line-through decoration-muted-foreground/50"
            )}
            rows={1}
            wrap="soft"
            placeholder={index === 0 ? placeholder : ''}
            value={item.text}
            onMouseDown={() => {
              if (allSelected) setAllSelected(false);
            }}
            onChange={(e) => {
              if (allSelected) setAllSelected(false);
              resizeTextarea(e.currentTarget);
              handleItemChange(index, e.target.value);
            }}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onCopy={handleCopy}
            onPaste={(e) => handlePaste(index, e)}
            onBlur={handleBlur}
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={() => { isComposing.current = false; }}
          />
        </div>
      ))}
    </div>
  );
}

interface ChecklistViewerProps {
  value: string;
  className?: string;
  emptyText?: string;
}

export function ChecklistViewer({ value, className, emptyText }: ChecklistViewerProps) {
  const items = parseChecklist(value);
  const validItems = items.filter(item => item.text.trim() !== '');

  if (validItems.length === 0) {
    return (
      <div className={className}>
        <p className="whitespace-pre-wrap text-xs leading-[1.35rem] text-muted-foreground italic">
          {emptyText || 'No tasks logged yet'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {validItems.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="mt-[2px] shrink-0 text-muted-foreground">
            {item.checked ? (
              <CheckSquare className="w-3.5 h-3.5 opacity-80" />
            ) : (
              <Square className="w-3.5 h-3.5 opacity-40" />
            )}
          </div>
          <span
            className={cn(
              "flex-1 text-xs leading-[1.1rem] break-words min-w-0",
              item.checked ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground/90"
            )}
          >
            {item.text}
          </span>
        </div>
      ))}
    </div>
  );
}
