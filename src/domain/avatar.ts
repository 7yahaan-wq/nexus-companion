import type { AgentRun, AvatarState } from './types';

export const avatarStates: AvatarState[] = [
  'idle',
  'working',
  'thinking',
  'happy',
  'warning',
  'error',
  'sleepy',
  'celebrate',
];

export const avatarLabels: Record<AvatarState, string> = {
  idle: '悠闲陪伴',
  working: '专心工作',
  thinking: '认真思考',
  happy: '开心回应',
  warning: '温柔提醒',
  error: '一起解决',
  sleepy: '困困休息',
  celebrate: '庆祝完成',
};

export interface SpriteAnimation {
  sheet: string;
  row: number;
  frames: readonly number[];
  durations: readonly number[];
  still: number;
}

const calm = './assets/nia/calm.png';
// Four frames per row, positioned by niaFrames; hold rest poses longer than blinks.
// Four drawn action rows serve eight semantic states with different frame sequences.
export const niaAnimations: Record<AvatarState, SpriteAnimation> = {
  idle: { sheet: calm, row: 0, frames: [0, 1, 2, 3], durations: [2800, 120, 160, 180], still: 0 },
  working: { sheet: calm, row: 1, frames: [0, 1, 2, 3], durations: [350, 350, 350, 350], still: 0 },
  thinking: {
    sheet: calm,
    row: 2,
    frames: [0, 1, 2, 3],
    durations: [1800, 650, 160, 650],
    still: 0,
  },
  sleepy: {
    sheet: calm,
    row: 3,
    frames: [0, 1, 2, 3],
    durations: [2200, 900, 800, 1100],
    still: 1,
  },
  happy: { sheet: calm, row: 0, frames: [2, 3, 2, 0], durations: [1100, 400, 300, 700], still: 2 },
  warning: {
    sheet: calm,
    row: 2,
    frames: [0, 1, 0, 3],
    durations: [1800, 600, 180, 700],
    still: 0,
  },
  error: { sheet: calm, row: 2, frames: [0, 2, 0, 1], durations: [1800, 650, 650, 800], still: 1 },
  celebrate: {
    sheet: calm,
    row: 0,
    frames: [2, 3, 2, 3],
    durations: [450, 350, 400, 700],
    still: 2,
  },
};

export function resolveAvatarState(runs: AgentRun[], focus = false, now = Date.now()): AvatarState {
  const recent = (value: string | null | undefined, limit: number) => {
    const age = now - new Date(value || '').getTime();
    return Number.isFinite(age) && age >= 0 && age <= limit;
  };
  if (runs.some((r) => r.status === 'FAILED' && recent(r.endTime || r.observedAt, 300000)))
    return 'error';
  if (runs.some((r) => r.status === 'WAITING_APPROVAL' && recent(r.observedAt, 120000)))
    return 'warning';
  if (focus || runs.some((r) => r.status === 'RUNNING' && recent(r.observedAt, 120000)))
    return 'working';
  if (runs.some((r) => ['WAITING', 'STARTING'].includes(r.status) && recent(r.observedAt, 120000)))
    return 'thinking';
  const completed = runs.filter((r) => r.status === 'COMPLETED' && recent(r.endTime, 120000));
  if (completed.length > 1) return 'celebrate';
  if (completed.length) return 'happy';
  const hour = new Date(now).getHours();
  return hour >= 23 || hour < 6 ? 'sleepy' : 'idle';
}
