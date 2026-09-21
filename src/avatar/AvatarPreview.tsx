import { useState } from 'react';
import type { AvatarState, Entity } from '../domain/types';
import { avatarLabels, avatarStates } from '../domain/avatar';
import { L, useI18n } from '../domain/i18n';
import { Avatar, stateText } from './AvatarManager';

export default function AvatarPreview({ settings }: { settings: Entity }) {
  const [state, setState] = useState<AvatarState>('idle');
  const { t } = useI18n();
  return (
    <section className="panel settings-wide nia-preview">
      <h2>
        <L text="认识更多面的 Nia" />
      </h2>
      <p>
        <L text="眨眨眼，敲敲键盘，也会为你的小小进展开心。" />
      </p>
      <div className="nia-preview-layout">
        <div className="nia-preview-stage">
          <Avatar settings={{ ...settings, avatar: 'nia' }} state={state} />
          <p>{t(stateText[state])}</p>
        </div>
        <div className="nia-state-options" role="group" aria-label={t('Nia 状态预览')}>
          {avatarStates.map((value) => (
            <button
              key={value}
              aria-pressed={state === value}
              data-preview-state={value}
              onClick={() => setState(value)}
            >
              <span className={`state-swatch mood-${value}`} />
              <L text={avatarLabels[value]} />
            </button>
          ))}
          <p>
            <L text="这里可以预览表情；工作伙伴会根据你的工作状态自动变化。" />
          </p>
        </div>
      </div>
    </section>
  );
}
