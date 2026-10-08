import { L } from '../domain/i18n';
import { useEffect, useState, useCallback } from 'react';
import {
  Home as HomeIcon,
  Boxes,
  ListTodo,
  CalendarDays,
  FolderKanban,
  Activity,
  NotebookPen,
  Settings as SettingsIcon,
  Search,
  Orbit,
  ArrowUpRight,
  ShieldCheck,
  Timer,
  ChevronRight,
} from 'lucide-react';
import { api, uid, today } from '../domain/api';
import type { Entity } from '../domain/types';
import { useWorkspace } from '../domain/useWorkspace';
import { useAgents } from '../providers/useAgents';
import Home from '../features/home/Home';
import Projects from '../features/projects/Projects';
import Tasks, { TaskEditor } from '../features/tasks/Tasks';
import Calendar, { EventEditor, eventForTask } from '../features/calendar/Calendar';
import Agents from '../features/agents/Agents';
import Timeline from '../features/timeline/Timeline';
import Notes, { NoteEditor } from '../features/notes/Notes';
import Settings, { defaultSettings } from '../features/settings/Settings';
import Companion from '../avatar/AvatarManager';
import Focus, { useFocus, FocusBar, FocusCompletion } from '../features/focus/Focus';
import CommandPalette from '../components/CommandPalette';
import QuickCapture from '../components/QuickCapture';
import Onboarding from '../components/Onboarding';
import { LanguageContext, translate } from '../domain/i18n';
const nav = [
  ['Home', HomeIcon],
  ['Agents', Boxes],
  ['Tasks', ListTodo],
  ['Calendar', CalendarDays],
  ['Projects', FolderKanban],
  ['Timeline', Activity],
  ['Notes', NotebookPen],
  ['Settings', SettingsIcon],
] as const;
export default function App() {
  const workspace = useWorkspace(),
    agents = useAgents();
  const focus = useFocus(workspace.refresh);
  const [palette, setPalette] = useState(false),
    [capture, setCapture] = useState(false),
    [settingsLoaded, setSettingsLoaded] = useState(false);
  const [page, setPage] = useState('Home'),
    [settings, setSettings] = useState<Entity>(defaultSettings),
    [error, setError] = useState(''),
    [schedule, setSchedule] = useState<Entity | null>(null),
    [task, setTask] = useState<Entity | null>(null),
    [note, setNote] = useState<Entity | null>(null),
    [selectedNoteId, setSelectedNoteId] = useState(''),
    [noteSelectionRevision, setNoteSelectionRevision] = useState(0),
    [focusTaskId, setFocusTaskId] = useState(''),
    [notice, setNotice] = useState(''),
    [background, setBackground] = useState('');
  useEffect(() => {
    api<Entity[]>('list', 'settings')
      .then((s) => {
        const saved = s.find((x) => x.id === 'appearance');
        if (saved) setSettings({ ...defaultSettings, ...saved });
        setSettingsLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let valid = true;
    if (settings.backgroundImage)
      api<string>('asset', settings.backgroundImage)
        .then((s) => {
          if (valid) setBackground(s);
        })
        .catch((e) => setError(e.message));
    return () => {
      valid = false;
    };
  }, [settings.backgroundImage]);
  const update = useCallback(async (values: Entity) => {
    await api('save', 'settings', values);
    setSettings(values);
  }, []);
  const action = useCallback((value: string) => {
    setPalette(false);
    setCapture(false);
    setTask(null);
    setNote(null);
    setSchedule(null);
    if (value === 'capture') setCapture(true);
    else if (value === 'search') setPalette(true);
    else if (value === 'task')
      setTask({ id: uid(), status: 'Planned', priority: 'Medium', dueDate: today() });
    else if (value === 'note') setNote({ id: uid(), title: '', content: '' });
    else setPage(value);
  }, []);
  const t = (text: string, english?: string) => translate(settings.language, text, english);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);
  useEffect(() => {
    document.documentElement.lang = settings.language || 'zh-CN';
  }, [settings.language]);
  useEffect(() => {
    const back = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && page === 'Focus' && !document.querySelector('dialog[open]'))
        action('Home');
    };
    window.addEventListener('keydown', back);
    return () => window.removeEventListener('keydown', back);
  }, [page, action]);
  useEffect(
    () =>
      window.nexus?.onCommand((value) => {
        if (!document.querySelector('dialog[open]')) action(value);
      }),
    [action],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        setCapture(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const taskEditor = (value?: Entity) =>
    setTask(value || { id: uid(), status: 'Planned', priority: 'Medium', dueDate: today() });
  const openNote = (id: string) => {
    setSelectedNoteId(id);
    setNoteSelectionRevision((revision) => revision + 1);
    setPage('Notes');
  };
  const savedNote = (value: Entity) => {
    openNote(value.id);
    setNotice(t('灵感已保存', 'Idea saved'));
  };
  const openFocus = (value: Entity) => {
    setFocusTaskId(value.id);
    setPage('Focus');
  };
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const bg =
    settings.backgroundType === 'image' && background
      ? `url("${background}")`
      : settings.backgroundType === 'gradient'
        ? `radial-gradient(ellipse at 70% 0%,${settings.accent}24,transparent 65%)`
        : 'none';
  return (
    <LanguageContext.Provider value={settings.language || 'zh-CN'}>
      <div
        className="app"
        data-theme={settings.theme}
        data-companion-compact={settings.companionCompact ? 'true' : 'false'}
        style={
          {
            '--accent':
              settings.theme === 'light'
                ? `color-mix(in srgb, ${settings.accent}, #211846 45%)`
                : settings.accent,
            '--panel-opacity': `${settings.panelOpacity}%`,
            ...(settings.backgroundType === 'solid'
              ? { background: settings.backgroundColor }
              : {}),
          } as any
        }
      >
        <div
          className="app-background"
          style={{
            backgroundImage: bg,
            filter:
              settings.backgroundType === 'image'
                ? `blur(${settings.blur}px) brightness(${settings.brightness}%)`
                : 'none',
            opacity: settings.backgroundOpacity / 100,
          }}
        />
        <aside className="sidebar">
          <div className="brand">
            <Orbit size={30} />
            <div>
              NEXUS<span>COMPANION</span>
            </div>
          </div>
          <button className="search-button" onClick={() => setPalette(true)}>
            <Search size={16} />
            <L text="快速搜索" />
            <kbd>Ctrl K</kbd>
          </button>
          <div className="nav-label">{t('WORKSPACE')}</div>
          <nav>
            {nav.map(([label, Icon]) => (
              <button
                className={page === label ? 'active' : ''}
                key={label}
                data-page={label}
                onClick={() => action(label)}
              >
                <Icon size={18} />
                {t(label)}
                {page === label && <i />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button onClick={() => setPage('Focus')}>
              <Timer size={18} />
              {focus.session ? t('返回专注', 'Return to focus') : t('进入专注模式')}
              <ArrowUpRight size={14} />
            </button>
            <div className="local">
              <ShieldCheck size={15} />
              <span>{t('Local first. Yours only.')}</span>
              <i />
            </div>
            <div className="profile">
              <div className="profile-icon">N</div>
              <div>
                {t('My workspace')}
                <small>
                  <L text="把想法变成作品" />
                </small>
              </div>
            </div>
          </div>
        </aside>
        <main>
          <header>
            <div>
              Nexus <ChevronRight size={14} />
              <strong>{t(page)}</strong>
            </div>
            <span className="quiet">{t('YOUR PERSONAL COMMAND CENTER')}</span>
          </header>
          {(error || workspace.error) && (
            <button
              className="error error-toast"
              role="alert"
              onClick={() => {
                setError('');
                workspace.setError('');
              }}
            >
              {error || workspace.error} <span>×</span>
            </button>
          )}
          <div className="content">
            {notice && (
              <p className="success-notice" role="status">
                {notice}
              </p>
            )}
            {page !== 'Focus' && (
              <FocusBar workspace={workspace} focus={focus} onOpen={() => setPage('Focus')} />
            )}
            {(settings.notifications?.focus !== false || page === 'Focus') && (
              <FocusCompletion
                workspace={workspace}
                focus={focus}
                onOpen={() => setPage('Focus')}
              />
            )}
            <div className="page-heading">
              <div className="eyebrow">{t('A LITTLE CLARITY. A LOT OF POSSIBILITY.')}</div>
              <h1>
                {page === 'Home'
                  ? t('今天，让想法更近一步。', 'Bring your ideas a little closer today.')
                  : t(page)}
              </h1>
              <p>
                {new Date().toLocaleDateString(settings.language === 'en' ? 'en-US' : 'zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
                <span>·</span>
                <L text="你的工作，在这里井然有序。" />
              </p>
            </div>
            {page === 'Home' ? (
              <Home
                workspace={workspace}
                agents={agents}
                onAction={action}
                onTask={taskEditor}
                onNote={openNote}
                onFocus={openFocus}
              />
            ) : page === 'Projects' ? (
              <Projects
                {...workspace}
                runs={agents.runs}
                onTask={taskEditor}
                onNote={openNote}
                onFocus={openFocus}
              />
            ) : page === 'Tasks' ? (
              <Tasks
                workspace={workspace}
                onFocus={openFocus}
                onNote={openNote}
                onSchedule={(t) => {
                  setPage('Calendar');
                  setSchedule(eventForTask(t));
                }}
              />
            ) : page === 'Calendar' ? (
              <Calendar workspace={workspace} />
            ) : page === 'Agents' ? (
              <Agents agents={agents} setError={setError} />
            ) : page === 'Timeline' ? (
              <Timeline workspace={workspace} agents={agents.runs} />
            ) : page === 'Notes' ? (
              <Notes
                workspace={workspace}
                selectedNoteId={selectedNoteId}
                selectionRevision={noteSelectionRevision}
                onSelectNote={setSelectedNoteId}
                onTask={taskEditor}
              />
            ) : page === 'Settings' ? (
              <Settings
                settings={settings}
                update={(s) => update(s).catch((e) => setError(e.message))}
                setError={setError}
              />
            ) : (
              <Focus
                workspace={workspace}
                settings={settings}
                runs={agents.runs}
                focus={focus}
                initialTaskId={focusTaskId}
                onClose={() => action('Home')}
              />
            )}
          </div>
        </main>
        <Companion
          settings={settings}
          runs={agents.runs}
          focus={!!focus.session && !focus.session.paused}
          onAction={action}
          onCompact={() =>
            update({ ...settings, companionCompact: !settings.companionCompact }).catch((e) =>
              setError(e.message),
            )
          }
        />
        {settingsLoaded && !settings.onboarded && (
          <Onboarding settings={settings} update={update} workspace={workspace} />
        )}{' '}
        {palette && (
          <CommandPalette
            workspace={workspace}
            runs={agents.runs}
            onAction={action}
            onClose={() => setPalette(false)}
            onSelect={(kind, e) => {
              if (kind === 'tasks') setTask(e);
              else if (kind === 'notes') setNote(e);
              else if (kind === 'events') setSchedule(e);
              else setPage(kind === 'projects' ? 'Projects' : 'Agents');
            }}
          />
        )}{' '}
        {capture && (
          <QuickCapture
            workspace={workspace}
            onClose={() => setCapture(false)}
            onSaved={(kind, value) => {
              if (kind === 'notes') savedNote(value);
              else {
                setPage('Tasks');
                setNotice(t('任务已保存到收集箱', 'Task saved to Inbox'));
              }
            }}
          />
        )}
        {task && (
          <TaskEditor
            key={task.id}
            task={task}
            workspace={workspace}
            onClose={() => setTask(null)}
          />
        )}{' '}
        {note && (
          <NoteEditor
            key={note.id}
            note={note}
            workspace={workspace}
            onClose={() => setNote(null)}
            onSaved={savedNote}
          />
        )}{' '}
        {schedule && (
          <EventEditor event={schedule} workspace={workspace} onClose={() => setSchedule(null)} />
        )}
      </div>
    </LanguageContext.Provider>
  );
}
