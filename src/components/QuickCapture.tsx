import { L } from '../domain/i18n';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from './Modal';
import { uid, today } from '../domain/api';
import type { WorkspaceActions } from '../domain/useWorkspace';
export default function QuickCapture({
  workspace,
  onClose,
}: {
  workspace: WorkspaceActions;
  onClose: () => void;
}) {
  const [value, setValue] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    const note = /^NOTE\s+/i.test(text);
    const title = text.replace(/^(TODO|NOTE)\s+/i, '').trim();
    if (!title) {
      setError('请写下一点内容。');
      return;
    }
    setBusy(true);
    try {
      await workspace.save(note ? 'notes' : 'tasks', {
        id: uid(),
        title: note ? title.slice(0, 60) : title,
        content: note ? title : undefined,
        status: note ? undefined : 'Inbox',
        priority: 'Medium',
        dueDate: today(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <Modal title="捕捉一个想法" onClose={onClose}>
      <p>TODO 创建任务 · NOTE 留下笔记 · 无前缀默认为任务</p>
      <form onSubmit={submit}>
        <textarea
          className="capture-input"
          autoFocus
          aria-label="快速记录内容"
          placeholder="TODO 今天想完成什么？"
          rows={4}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
          }}
        />
        {error && <p className="error">{error}</p>}
        <footer className="modal-actions">
          <span className="quiet">Ctrl + Enter 保存</span>
          <button type="submit" className="primary" disabled={busy}>
            <Plus size={15} />
            <L text="保存记录" />
          </button>
        </footer>
      </form>
    </Modal>
  );
}
