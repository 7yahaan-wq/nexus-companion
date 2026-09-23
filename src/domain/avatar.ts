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

export const avatarTriggers: Record<AvatarState, string> = {
  idle: '白天没有近期 Agent 活动，也没有进行中的专注时出现。',
  working: '正在专注，或最近 2 分钟内观测到 Codex 会话运行时出现。',
  thinking: '最近 2 分钟内观测到会话启动或等待时出现；当前本地适配器不保证识别这些状态。',
  happy: '最近 2 分钟内有一个 Codex 会话完成时出现。',
  warning: '最近 2 分钟内观测到会话等待审批时出现；当前本地适配器不保证识别审批状态。',
  error: 'Codex 会话失败后的 5 分钟内出现，优先于其他状态。',
  sleepy: '本地时间 23:00 至次日 06:00，且没有更高优先级状态时出现。',
  celebrate: '最近 2 分钟内有多个 Codex 会话完成时出现。',
};

export interface SpriteAnimation {
  sheet: string;
  frames: readonly number[];
  durations: readonly number[];
  still: number;
  loop: boolean;
}

const twelveFrames = Array.from({ length: 12 }, (_, index) => index);
const animation = (
  state: AvatarState,
  durations: readonly number[],
  still: number,
  loop: boolean,
): SpriteAnimation => ({
  sheet: './assets/nia/animations/' + state + '.png',
  frames: twelveFrames,
  durations,
  still,
  loop,
});

export const niaAnimations: Record<AvatarState, SpriteAnimation> = {
  idle: animation('idle', [950, 135, 135, 240, 135, 135, 170, 135, 135, 180, 135, 260], 0, true),
  working: animation(
    'working',
    [180, 140, 140, 150, 140, 140, 150, 140, 140, 150, 140, 220],
    3,
    true,
  ),
  thinking: animation(
    'thinking',
    [300, 160, 160, 290, 160, 160, 290, 160, 160, 240, 160, 250],
    5,
    true,
  ),
  happy: animation('happy', [160, 140, 140, 220, 170, 170, 260, 170, 170, 180, 160, 230], 5, false),
  warning: animation(
    'warning',
    [160, 140, 140, 220, 170, 170, 250, 170, 170, 180, 150, 220],
    5,
    false,
  ),
  error: animation('error', [180, 140, 140, 230, 170, 170, 260, 180, 180, 180, 150, 240], 5, false),
  sleepy: animation(
    'sleepy',
    [450, 230, 230, 390, 230, 230, 430, 230, 230, 390, 230, 480],
    7,
    true,
  ),
  celebrate: animation(
    'celebrate',
    [140, 130, 130, 190, 140, 140, 230, 150, 150, 170, 150, 240],
    5,
    false,
  ),
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
