import { L } from '../../domain/i18n';
import { useEffect, useState } from 'react';
import { Image, FolderOpen, Download, ShieldCheck } from 'lucide-react';
import { api } from '../../domain/api';
import DataSafety from './DataSafety';
import type { Entity } from '../../domain/types';
import { useI18n } from '../../domain/i18n';
import Connections from './Connections';
export const defaultSettings: Entity = {
  id: 'appearance',
  theme: 'dark',
  language: 'zh-CN',
  accent: '#aaa4ef',
  backgroundType: 'gradient',
  backgroundColor: '#10131b',
  blur: 6,
  brightness: 55,
  backgroundOpacity: 35,
  panelOpacity: 95,
  avatar: 'nia',
  notifications: { completed: true, failed: true, approval: true, calendar: true, focus: true },
  onboarded: false,
};
export default function Settings({
  settings,
  update,
  setError,
}: {
  settings: Entity;
  update: (s: Entity) => Promise<void>;
  setError: (s: string) => void;
}) {
  const { t } = useI18n();
  const [info, setInfo] = useState<any>({});
  const [pending, setPending] = useState('');
  useEffect(() => {
    api('info')
      .then((value) => {
        setInfo(value);
        setPending(value.pendingDataPath || '');
      })
      .catch((e) => setError(e.message));
  }, []);
  const change = (key: string, value: any) => update({ ...settings, [key]: value });
  async function importBackground() {
    try {
      const id = await api('importBackground');
      if (id) await update({ ...settings, backgroundType: 'image', backgroundImage: id });
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function importAvatar() {
    try {
      const pack = await api('importAvatar');
      if (pack) await update({ ...settings, avatar: 'custom', avatarPack: pack });
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel settings-wide">
        <h2>{t('语言与地区', 'Language & region')}</h2>
        <label>
          {t('界面语言', 'Display language')}
          <select
            aria-label="Language / 语言"
            value={settings.language || 'zh-CN'}
            onChange={(e) => change('language', e.target.value)}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <p>
          {t(
            '切换立即生效，项目名称、笔记与 Codex 原始输出保持原文。',
            'Changes apply immediately. Your content and Codex output keep their original language.',
          )}
        </p>
      </section>
      <Connections setError={setError} />
      <DataSafety setError={setError} />
      <section className="panel">
        <h2>
          {t('Appearance')}{' '}
          <span>
            <L text="让这里更像你" />
          </span>
        </h2>
        <label>
          <L text="主题" />
          <select
            aria-label="主题"
            value={settings.theme}
            onChange={(e) => change('theme', e.target.value)}
          >
            <option value="dark">深色 · Midnight</option>
            <option value="light">浅色 · Morning</option>
          </select>
        </label>
        <label>
          <L text="强调色" />
          <input
            aria-label="强调色"
            type="color"
            value={settings.accent}
            onChange={(e) => change('accent', e.target.value)}
          />
        </label>
        <label>
          <L text="背景" />
          <select
            aria-label="背景类型"
            value={settings.backgroundType}
            onChange={(e) => change('backgroundType', e.target.value)}
          >
            <option value="gradient">
              <L text="柔和渐变" />
            </option>
            <option value="solid">
              <L text="纯色" />
            </option>
            <option value="image">
              <L text="本地图片" />
            </option>
          </select>
        </label>
        {settings.backgroundType === 'image' ? (
          <button className="secondary" onClick={importBackground}>
            <Image size={15} />
            选择 PNG / JPG / WEBP
          </button>
        ) : (
          <label>
            <L text="背景颜色" />
            <input
              aria-label="背景颜色"
              type="color"
              value={settings.backgroundColor}
              onChange={(e) => change('backgroundColor', e.target.value)}
            />
          </label>
        )}
        {[
          ['blur', '模糊', 0, 30],
          ['brightness', '亮度', 10, 100],
          ['backgroundOpacity', '背景可见度', 0, 100],
          ['panelOpacity', '面板不透明度', 45, 100],
        ].map(([key, label, min, max]) => (
          <label key={key}>
            <span>
              {label} <small>{settings[key]}</small>
            </span>
            <input
              aria-label={String(label)}
              type="range"
              min={min}
              max={max}
              value={settings[key]}
              onChange={(e) => change(String(key), Number(e.target.value))}
            />
          </label>
        ))}
        <p>图片副本保存在下方所示的数据目录。</p>
      </section>
      <section className="panel">
        <h2>
          {t('Companion')}{' '}
          <span>
            <L text="始终在这里" />
          </span>
        </h2>
        <label>
          <L text="角色" />
          <select
            aria-label="角色"
            value={settings.avatar}
            onChange={(e) => change('avatar', e.target.value)}
          >
            <option value="nia">Nia · 2D Companion</option>
            <option value="orb">Nexus Core · Minimal</option>
            {settings.avatarPack && <option value="custom">{settings.avatarPack.name}</option>}
          </select>
        </label>
        <button className="secondary" onClick={importAvatar}>
          <Download size={15} />
          <L text="导入 Avatar Pack" />
        </button>
        <p>
          选择 avatar.json。支持 8 种状态的本地图片资源，配合轻量动画。Live2D / Spine 为后续适配器。
        </p>
        <h3>{t('Notifications')}</h3>
        {[
          ['completed', 'Agent 完成'],
          ['failed', 'Agent 失败'],
          ['approval', '等待审批'],
          ['calendar', '日程提醒'],
          ['focus', '专注结束'],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              aria-label={label}
              type="checkbox"
              checked={settings.notifications?.[key] !== false}
              onChange={(e) =>
                change('notifications', { ...settings.notifications, [key]: e.target.checked })
              }
            />
          </label>
        ))}
        <button
          className="secondary"
          onClick={() =>
            api('notify', 'Nexus Companion', '通知测试：陪你，把想法变成作品。')
              .then((ok) => {
                if (!ok) setError('Windows 通知当前不可用');
              })
              .catch((e) => setError(e.message))
          }
        >
          <L text="发送测试通知" />
        </button>
      </section>
      <section className="panel settings-wide">
        <h2>
          <ShieldCheck size={17} />
          {t('Local only')} <span>v{info.version}</span>
        </h2>
        <p>项目、日程、笔记、Agent 记录与设置均保存在此电脑，不自动上传。</p>
        <div className="path-text">{info.dataPath}</div>
        {info.ready && info.shortcut === false && <p role="status">全局快捷键被其他程序或 Nexus 实例占用。窗口内仍可使用 Ctrl + Shift + Space，也可从托盘打开快速记录。</p>}
        <p>
          选择文件夹后，应用会在其中创建
          NexusCompanion-Data。下次启动时复制并校验数据，旧目录保留；应用缓存仍由系统管理。
        </p>
        <button
          className="secondary"
          onClick={async () => {
            try {
              const target = await api('chooseDataLocation');
              if (target) setPending(target);
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <L text="选择数据保存位置" />
        </button>
        {pending && (
          <div role="status">
            <p>重启后迁移至：{pending}</p>
            <button
              className="primary"
              onClick={() => api('restart').catch((e) => setError(e.message))}
            >
              <L text="重启并迁移数据" />
            </button>
            <button
              onClick={() =>
                api('cancelDataLocation')
                  .then(() => setPending(''))
                  .catch((e) => setError(e.message))
              }
            >
              <L text="取消迁移" />
            </button>
          </div>
        )}
        <div className="toolbar wrap">
          <button onClick={() => api('openLogs').catch((e) => setError(e.message))}>
            <FolderOpen size={15} />
            <L text="打开日志目录" />
          </button>
          <button onClick={() => change('onboarded', false)}>
            <L text="重新打开欢迎引导" />
          </button>
        </div>
        <p>
          全局快捷键 Ctrl + Shift + Space · 快速记录。Ctrl + K ·
          搜索与命令。关闭窗口后保留在托盘；在托盘选择 Exit 完全退出。
        </p>
      </section>
    </div>
  );
}
