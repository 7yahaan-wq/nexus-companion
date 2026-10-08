import { useEffect, useRef, useState } from 'react';
import { api, uid } from './api';
import type { Entity } from './types';

// Keep writes ordered even when a dialog closes and another editor opens immediately.
const writes = new Map<string, Promise<unknown>>();
function ordered<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const next = (writes.get(key) || Promise.resolve()).catch(() => {}).then(operation);
  writes.set(key, next);
  void next
    .finally(() => {
      if (writes.get(key) === next) writes.delete(key);
    })
    .catch(() => {});
  return next;
}

type DraftStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

/** The caller should remount the editor when switching to a different entity. */
export function useDraft(key: string | undefined, initial: Entity) {
  const original = useRef(initial);
  const current = useRef(initial);
  const revision = useRef<string | undefined>(undefined);
  const latestWrite = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(false);
  const [form, setForm] = useState(initial);
  const [ready, setReady] = useState(!key);
  const [status, setStatus] = useState<DraftStatus>(key ? 'loading' : 'idle');
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (key) {
      void ordered(key, async () => {
        const records = await api<Entity[]>('list', 'settings');
        return records.find((record) => record.id === key);
      })
        .then((saved) => {
          if (!active) return;
          if (saved) {
            const noteId = key.startsWith('draft:note:') ? key.slice('draft:note:'.length) : '';
            if (
              !saved.value ||
              typeof saved.value !== 'object' ||
              Array.isArray(saved.value) ||
              typeof saved.value.id !== 'string' ||
              !saved.value.id ||
              saved.value.id.length > 200 ||
              typeof saved.revision !== 'string' ||
              !saved.revision ||
              saved.revision.length > 200 ||
              (noteId && noteId !== 'new' && saved.value.id !== noteId)
            )
              throw Error('本地草稿无效，未覆盖当前笔记。');
            const recovered = { ...original.current, ...saved.value };
            // A shared new-note draft owns its ID, regardless of the entry point used to reopen it.
            original.current = { ...original.current, id: recovered.id };
            current.current = recovered;
            revision.current = saved.revision;
            setForm(recovered);
            setRestored(true);
            setStatus('saved');
          } else {
            setStatus('idle');
          }
          setReady(true);
        })
        .catch((cause: Error) => {
          if (!active) return;
          setError(cause.message);
          setStatus('error');
          // Do not let a failed read overwrite a draft which may still exist on disk.
        });
    }
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [key]);

  function persist(value: Entity): Promise<void> {
    if (!key) return Promise.resolve();
    const nextRevision = uid();
    revision.current = nextRevision;
    setStatus('saving');
    setError('');
    const pending = ordered(key, async () => {
      await api('save', 'settings', {
        id: key,
        value,
        revision: nextRevision,
        updatedAt: new Date().toISOString(),
      });
    });
    latestWrite.current = pending;
    void pending
      .then(() => {
        if (mounted.current && revision.current === nextRevision) setStatus('saved');
      })
      .catch((cause: Error) => {
        if (mounted.current && revision.current === nextRevision) {
          setError(cause.message);
          setStatus('error');
        }
      });
    return pending;
  }

  function change(field: string, value: unknown) {
    const next = { ...current.current, [field]: value };
    current.current = next;
    setForm(next);
    if (key) void persist(next).catch(() => {});
  }

  async function flush() {
    if (!key || !revision.current) return;
    try {
      await latestWrite.current;
    } catch {
      await persist(current.current);
    }
  }

  async function clear() {
    if (!key || !revision.current) return;
    const ownedRevision = revision.current;
    await ordered(key, async () => {
      const records = await api<Entity[]>('list', 'settings');
      const saved = records.find((record) => record.id === key);
      // An older editor must never remove a newer editor's draft.
      if (saved?.revision === ownedRevision) await api('delete', 'settings', key);
    });
    if (revision.current === ownedRevision) revision.current = undefined;
  }

  async function discard() {
    await clear();
    current.current = original.current;
    setForm(original.current);
    setRestored(false);
    setStatus('idle');
    setError('');
  }

  return {
    form,
    ready,
    status,
    restored,
    error,
    change,
    flush,
    clear,
    discard,
    dirty: JSON.stringify(form) !== JSON.stringify(original.current),
  };
}
