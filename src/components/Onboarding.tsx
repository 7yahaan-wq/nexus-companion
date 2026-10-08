import { L } from '../domain/i18n';
import { useState } from 'react';
import { Orbit, FolderOpen, ArrowRight, Check } from 'lucide-react';
import Modal from './Modal';
import { Avatar } from '../avatar/AvatarManager';
import { api, uid } from '../domain/api';
import type { Entity } from '../domain/types';
import type { WorkspaceActions } from '../domain/useWorkspace';
export default function Onboarding({
  settings,
  update,
  workspace,
}: {
  settings: Entity;
  update: (s: Entity) => Promise<void>;
  workspace: WorkspaceActions;
}) {
  const [step, setStep] = useState(0),
    [directory, setDirectory] = useState(''),
    [name, setName] = useState(''),
    [theme, setTheme] = useState(settings.theme),
    [avatar, setAvatar] = useState(settings.avatar),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function finish() {
    setBusy(true);
    try {
      if (directory) {
        const info = await api('projectInspect', directory);
        await workspace.save('projects', {
          id: uid(),
          name: name.trim() || directory.split(/[\\/]/).pop() || 'My Project',
          projectPath: directory,
          engine: info.engine,
          description: '',
          color: settings.accent,
          icon: '◇',
          createdAt: new Date().toISOString(),
        });
      }
      await update({ ...settings, onboarded: true, theme, avatar, workspaceDirectory: directory });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Welcome to Nexus"
      onClose={() => {
        if (!busy) update({ ...settings, onboarded: true }).catch((e) => setError(e.message));
      }}
    >
      <div className="onboarding">
        <div className="onboarding-steps">
          {[0, 1, 2, 3, 4].map((i) => (
            <i className={i <= step ? 'active' : ''} key={i} />
          ))}
        </div>
        {step === 0 ? (
          <>
            <Orbit size={48} />
            <h1>你的想法，值得被好好陪伴。</h1>
            <p>
              一个安静的工作空间，让项目、AI 与日常节奏相遇。
              <br />
              所有数据只保存在你的电脑。
            </p>
          </>
        ) : step === 1 ? (
          <>
            <FolderOpen size={40} />
            <h2>
              <L text="选择工作目录" />
            </h2>
            <p>导入已有项目，或者稍后再添加。</p>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  const p = await api('chooseDirectory');
                  if (p) {
                    setDirectory(p);
                    setName(p.split(/[\\/]/).pop());
                  }
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              {directory || '选择文件夹'}
            </button>
          </>
        ) : step === 2 ? (
          <>
            <h2>
              <L text="你的第一个项目" />
            </h2>
            {directory && (
              <label>
                <L text="项目名称" />
                <input
                  aria-label="首个项目名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My next creation"
                />
              </label>
            )}
            <p>{directory || '尚未选择目录，可以进入应用后再创建项目。'}</p>
          </>
        ) : step === 3 ? (
          <>
            <h2>
              <L text="选择你的工作氛围" />
            </h2>
            <div className="theme-options">
              <button
                className={theme === 'dark' ? 'selected' : ''}
                onClick={() => setTheme('dark')}
              >
                ☾ Midnight
              </button>
              <button
                className={theme === 'light' ? 'selected' : ''}
                onClick={() => setTheme('light')}
              >
                ☀ Morning
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>
              <L text="认识你的工作伙伴" />
            </h2>
            <Avatar settings={{ ...settings, avatar }} />
            <div className="segmented">
              <button className={avatar === 'nia' ? 'active' : ''} onClick={() => setAvatar('nia')}>
                Nia
              </button>
              <button className={avatar === 'orb' ? 'active' : ''} onClick={() => setAvatar('orb')}>
                Nexus Core
              </button>
            </div>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <footer className="modal-actions">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}>
              <L text="上一步" />
            </button>
          )}
          {step < 4 ? (
            <button className="primary" onClick={() => setStep(step + 1)}>
              <L text="继续" />
              <ArrowRight size={15} />
            </button>
          ) : (
            <button className="primary" onClick={finish} disabled={busy}>
              <L text="进入工作台" />
              <Check size={15} />
            </button>
          )}
        </footer>
      </div>
    </Modal>
  );
}
