import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from './Modal';
import { api, uid, today } from '../domain/api';
import { useI18n } from '../domain/i18n';
import { useDraft } from '../domain/useDraft';
import type { Entity } from '../domain/types';
import type { WorkspaceActions } from '../domain/useWorkspace';
type Props = {
  workspace: WorkspaceActions;
  onClose: () => void;
  onSaved?: (kind: string, value: Entity) => void;
};
export default function QuickCapture(props: Props) {
  const [initial, setInitial] = useState<Entity | null>(null);
  const [error, setError] = useState('');
  const { t } = useI18n();
  useEffect(() => {
    let active = true;
    api<Entity[]>('list', 'settings')
      .then((rows) => {
        if (active)
          setInitial({
            id: uid(),
            kind:
              rows.find((r) => r.id === 'capture-preferences')?.kind === 'tasks'
                ? 'tasks'
                : 'notes',
            text: '',
          });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!initial)
    return (
      <Modal title="捕捉一个想法" onClose={props.onClose}>
        <p role="status">{error || t('正在恢复记录…', 'Restoring capture…')}</p>
      </Modal>
    );
  return <CaptureForm {...props} initial={initial} />;
}
function CaptureForm({ workspace, onClose, onSaved, initial }: Props & { initial: Entity }) {
  const { t } = useI18n();
  const draft = useDraft('draft:capture', initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (draft.ready) input.current?.focus();
  }, [draft.ready]);
  const text = String(draft.form.text || '');
  const prefix = /^(TODO|NOTE)\s+/i.exec(text.trim());
  const kind = prefix
    ? prefix[1].toUpperCase() === 'NOTE'
      ? 'notes'
      : 'tasks'
    : draft.form.kind === 'tasks'
      ? 'tasks'
      : 'notes';
  async function close() {
    if (lock.current) return;
    if (!draft.ready) {
      onClose();
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await draft.flush();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || !draft.ready) return;
    const content = text
      .trim()
      .replace(/^(TODO|NOTE)\s+/i, '')
      .trim();
    if (!content) {
      setError(t('请写下一点内容。', 'Write something first.'));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    const stamp = new Date().toISOString();
    const value =
      kind === 'notes'
        ? {
            id: draft.form.id,
            title: content.split('\n')[0].slice(0, 60),
            content,
            createdAt: stamp,
            updatedAt: stamp,
          }
        : {
            id: draft.form.id,
            title: content,
            status: 'Inbox',
            priority: 'Medium',
            dueDate: today(),
            createdAt: stamp,
            updatedAt: stamp,
          };
    try {
      await workspace.save(kind, value);
      await api('save', 'settings', { id: 'capture-preferences', kind });
      await draft.clear();
      onSaved?.(kind, value);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal title="捕捉一个想法" onClose={close}>
      <form onSubmit={submit}>
        <div className="segmented capture-kind" aria-label={t('记录类型', 'Capture type')}>
          {(['notes', 'tasks'] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={!draft.ready || busy}
              aria-pressed={kind === value}
              className={kind === value ? 'active' : ''}
              onClick={() => {
                draft.change('kind', value);
                if (prefix) draft.change('text', text.trim().replace(/^(TODO|NOTE)\s+/i, ''));
              }}
            >
              {value === 'notes' ? t('灵感', 'Idea') : t('任务', 'Task')}
            </button>
          ))}
        </div>
        <p className="quiet">
          {kind === 'notes'
            ? t('保存到灵感笔记', 'Save to Ideas & notes')
            : t('保存到任务收集箱', 'Save to task Inbox')}
        </p>
        <textarea
          className="capture-input"
          ref={input}
          disabled={!draft.ready || busy}
          aria-label="快速记录内容"
          placeholder={t('先写下来，稍后再整理。', 'Capture now, organize later.')}
          rows={5}
          value={text}
          onChange={(e) => draft.change('text', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
          }}
        />
        <p className="quiet" role="status">
          {draft.ready
            ? t(
                '关闭后保留草稿。也支持 TODO / NOTE 前缀。',
                'Closing keeps your draft. TODO / NOTE prefixes also work.',
              )
            : t('正在恢复草稿…', 'Restoring draft…')}
        </p>
        {(error || draft.error) && (
          <p className="error" role="alert">
            {error || draft.error}
          </p>
        )}
        <footer className="modal-actions">
          <span className="quiet">Ctrl + Enter</span>
          <button type="button" disabled={busy || !draft.ready} onClick={close}>
            {t('稍后继续', 'Continue later')}
          </button>
          <button type="submit" className="primary" disabled={busy || !draft.ready}>
            <Plus size={15} />
            {busy ? t('保存中…', 'Saving…') : t('保存记录')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
