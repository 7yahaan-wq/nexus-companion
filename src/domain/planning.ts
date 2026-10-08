import type { Entity } from './types';

export interface DailyPlan extends Entity {
  date: string;
  topTaskIds: string[];
  capacityMinutes: number;
  startedAt: string | null;
  closedAt: string | null;
  reflection: string;
}

export function dailyPlan(day: string, saved?: Entity): DailyPlan {
  const capacity = Number(saved?.capacityMinutes);
  return {
    id: `daily-plan:${day}`,
    date: day,
    topTaskIds: Array.isArray(saved?.topTaskIds)
      ? ([...new Set(saved.topTaskIds.filter((id: unknown) => typeof id === 'string'))].slice(
          0,
          3,
        ) as string[])
      : [],
    capacityMinutes: Number.isFinite(capacity) && capacity >= 0 ? Math.min(1440, capacity) : 240,
    startedAt: saved?.startedAt || null,
    closedAt: saved?.closedAt || null,
    reflection: typeof saved?.reflection === 'string' ? saved.reflection : '',
  };
}

export function unfinished(task: Entity) {
  return !['Done', 'Cancelled'].includes(task.status);
}

export function overdue(task: Entity, day: string) {
  return (
    unfinished(task) &&
    typeof task.dueDate === 'string' &&
    task.dueDate.length > 0 &&
    task.dueDate < day
  );
}

export function workForDay(tasks: Entity[], day: string, topTaskIds: string[] = []) {
  return tasks
    .filter(
      (task) =>
        unfinished(task) &&
        (overdue(task, day) ||
          task.dueDate === day ||
          (task.startDate && task.startDate <= day) ||
          task.status === 'In Progress' ||
          topTaskIds.includes(task.id)),
    )
    .sort((a, b) => {
      const urgent = Number(overdue(b, day)) - Number(overdue(a, day));
      if (urgent) return urgent;
      const pinned = Number(topTaskIds.includes(b.id)) - Number(topTaskIds.includes(a.id));
      if (pinned) return pinned;
      return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
    });
}

export function planLoad(tasks: Entity[], topTaskIds: string[]) {
  const selected = tasks.filter((task) => topTaskIds.includes(task.id) && unfinished(task));
  return {
    minutes: selected.reduce(
      (total, task) => total + Math.max(0, Number(task.estimatedTime) || 0),
      0,
    ),
    unestimated: selected.filter((task) => !(Number(task.estimatedTime) > 0)).length,
  };
}
