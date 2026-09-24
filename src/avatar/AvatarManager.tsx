import { L } from '../domain/i18n';
import { useEffect, useState, useRef } from 'react';
import { Orbit, Timer, ListTodo, NotebookPen, Boxes, LayoutDashboard } from 'lucide-react';
import { api } from '../domain/api';
import type { AgentRun, AvatarState, Entity } from '../domain/types';
import { avatarLabels, niaAnimations, resolveAvatarState } from '../domain/avatar';
import { useSpritePlayback } from './useSpritePlayback';
import { useI18n } from '../domain/i18n';
export { resolveAvatarState } from '../domain/avatar';
export const stateText: Record<AvatarState, string> = {
  idle: '慢慢来，我们一起完成。',
  working: '我在这里，陪你专注。',
  thinking: '留一点空间，让想法发生。',
  happy: '又向前一步，做得很好。',
  warning: '有一件事，需要你看一眼。',
  error: '遇到一点问题，我们一起看看。',
  sleepy: '夜深了，也记得照顾自己。',
  celebrate: '今天的努力，正在开花。',
};
export function Avatar({
  settings,
  state = 'idle',
  large = false,
}: {
  settings: Entity;
  state?: AvatarState;
  large?: boolean;
}) {
  const { t } = useI18n();
  const [asset, setAsset] = useState({ id: '', src: '' });
  const [failedSheet, setFailedSheet] = useState('');
  const [failedPortrait, setFailedPortrait] = useState('');
  const id = settings.avatar === 'custom' ? settings.avatarPack?.states?.[state] : null;
  const animation = niaAnimations[state];
  const portrait = settings.avatar === 'nia' && settings.avatarDisplay === 'portrait';
  const portraitSrc = './assets/nia/portraits/' + state + '.png';
  const { frame, playing } = useSpritePlayback(animation, settings.avatarMotion !== false && !portrait);
  useEffect(() => {
    let valid = true;
    if (id)
      api<string>('asset', id)
        .then((s) => {
          if (valid) setAsset({ id, src: s });
        })
        .catch(() => {
          if (valid) setAsset({ id, src: '' });
        });
    return () => {
      valid = false;
    };
  }, [id]);
  const customSrc = id === asset.id ? asset.src : '';
  const builtin = settings.avatar !== 'custom' && failedSheet !== animation.sheet;
  return (
    <div
      className={`avatar-render mood-${state} ${large ? 'large' : ''}`}
      data-state={state}
      data-motion={playing ? 'playing' : 'still'}
      data-display={portrait ? 'portrait' : 'animation'}
      role="img"
      aria-label={`${settings.avatar === 'orb' ? 'Nexus Core' : settings.avatarPack && settings.avatar === 'custom' ? settings.avatarPack.name : 'Nia'} · ${t(avatarLabels[state])}`}
    >
      {settings.avatar === 'orb' ? (
        <div className="avatar-orb">
          <Orbit size={110} strokeWidth={1} />
        </div>
      ) : portrait && failedPortrait !== portraitSrc ? (
        <img className="nia-portrait" src={portraitSrc} alt="" aria-hidden="true" draggable={false} onError={() => setFailedPortrait(portraitSrc)} />
      ) : builtin ? (
        <div className="nia-sprite" data-frame={frame} data-state={state}>
          <img
            key={animation.sheet}
            src={animation.sheet}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{
              left: String(-(frame % 6) * 100) + '%',
              top: String(-Math.floor(frame / 6) * 100) + '%',
            }}
            onError={() => setFailedSheet(animation.sheet)}
          />
        </div>
      ) : (
        <img src={customSrc || './assets/nia.png'} alt="" aria-hidden="true" draggable={false} />
      )}
      <span className="avatar-state-mark" aria-hidden="true">
        {
          {
            idle: '✧',
            working: '⌨',
            thinking: '…',
            happy: '♡',
            warning: '!',
            error: '!',
            sleepy: '☾',
            celebrate: '✦',
          }[state]
        }
      </span>
    </div>
  );
}
export default function Companion({
  settings,
  runs,
  focus,
  onAction,
  onDisplayChange,
}: {
  settings: Entity;
  runs: AgentRun[];
  focus?: boolean;
  onAction: (action: string) => void;
  onDisplayChange: (display: 'animation' | 'portrait') => void;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const [, setClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClock((value) => value + 1), 15000);
    return () => clearInterval(timer);
  }, []);
  const menuRoot = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => {
      if (!menuRoot.current?.contains(e.target as Node)) setMenu(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);
  const state = resolveAvatarState(runs, focus);
  return (
    <aside className="companion-rail" ref={menuRoot}>
      <div className="rail-title">
        <span className="rail-heading"><L text="YOUR COMPANION" /></span>
        {settings.avatar === 'nia' && (
          <button type="button" className="nia-display-toggle" aria-label={t('切换 Nia 展示方式', 'Switch Nia display')} onClick={() => onDisplayChange(settings.avatarDisplay === 'portrait' ? 'animation' : 'portrait')}>
            {settings.avatarDisplay === 'portrait' ? t('立绘', 'Portrait') : t('动画', 'Animation')}
          </button>
        )}
      </div>
      <button className="companion-art" aria-label="Nia 快捷操作" onClick={() => setMenu(!menu)}>
        <Avatar settings={settings} state={state} />
        <span className="online-label">
          ●{' '}
          {settings.avatar === 'custom'
            ? settings.avatarPack?.name
            : settings.avatar === 'orb'
              ? 'NEXUS CORE'
              : 'NIA'}{' '}
          · {state.toUpperCase()}
        </span>
      </button>
      {menu && (
        <div className="companion-menu">
          {[
            ['Tasks', '今日任务', ListTodo],
            ['Agents', '运行 Agent', Boxes],
            ['note', '快速笔记', NotebookPen],
            ['Focus', '开始专注', Timer],
            ['Home', '工作台', LayoutDashboard],
          ].map(([id, label, Icon]: any) => (
            <button
              key={id}
              onClick={() => {
                setMenu(false);
                onAction(id);
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="speech">
        <span>“</span>
        <h3>{stateText[state]}</h3>
        <p>
          {state === 'error'
            ? '打开 Agent 面板查看真实错误记录。'
            : '把复杂的工作，变成一个个轻盈的小步骤。'}
        </p>
      </div>
      <div className="rail-section">
        <h3>
          今日节奏{' '}
          <span>
            <L text="YOUR PACE" />
          </span>
        </h3>
        <p className="quiet">
          {focus ? '你正在为重要的事情留出时间。' : '一次只做一件事，就很好。'}
        </p>
      </div>
      <div className="rail-footer">
        <span>✧</span> From ideas to reality.
        <br />
        Together.
      </div>
    </aside>
  );
}
