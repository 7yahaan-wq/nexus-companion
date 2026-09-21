import { useEffect, useState } from 'react';
import type { SpriteAnimation } from '../domain/avatar';
import { api } from '../domain/api';

export function useSpritePlayback(animation: SpriteAnimation, enabled: boolean) {
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [hidden, setHidden] = useState(() => document.hidden);
  const [windowHidden, setWindowHidden] = useState(false);
  const [cursor, setCursor] = useState({ animation, frame: animation.still });
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    let current = true;
    let receivedEvent = false;
    const unsubscribe = window.nexus?.onVisibility((visible) => {
      receivedEvent = true;
      setWindowHidden(!visible);
    });
    api<boolean>('windowVisible')
      .then((visible) => {
        if (current && !receivedEvent) setWindowHidden(!visible);
      })
      .catch(() => {});
    return () => {
      current = false;
      unsubscribe?.();
    };
  }, []);
  const playing = enabled && !reduced && !hidden && !windowHidden;
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      setCursor({ animation, frame: animation.frames[frame] });
      timer = setTimeout(() => {
        frame = (frame + 1) % animation.durations.length;
        advance();
      }, animation.durations[frame]);
    };
    advance();
    return () => clearTimeout(timer);
  }, [animation, playing]);
  return {
    frame: playing && cursor.animation === animation ? cursor.frame : animation.still,
    playing,
  };
}
