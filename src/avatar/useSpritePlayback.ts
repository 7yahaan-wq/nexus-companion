import { useEffect, useState } from 'react';
import { api } from '../domain/api';
import { niaAnimations, type SpriteAnimation } from '../domain/avatar';

const decodedSheets = new Map<string, Promise<void>>();
function decodeSheet(src: string) {
  if (!decodedSheets.has(src)) {
    const img = new Image();
    img.src = src;
    const ready = img.decode().catch(() => { decodedSheets.delete(src); });
    decodedSheets.set(src, ready);
  }
  return decodedSheets.get(src)!;
}

export function useSpritePlayback(animation: SpriteAnimation, enabled: boolean) {
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [hidden, setHidden] = useState(() => document.hidden);
  const [windowHidden, setWindowHidden] = useState(false);
  const [cursor, setCursor] = useState({ animation, frame: animation.frames[0] });
  useEffect(() => {
    Object.values(niaAnimations).forEach((item) => void decodeSheet(item.sheet));
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
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    let startedAt = 0;
    const totalDuration = animation.durations.reduce((sum, duration) => sum + duration, 0);
    const advance = () => {
      // Pick the frame from elapsed time, so a delayed callback does not slow the animation.
      const elapsed = performance.now() - startedAt;
      const position = animation.loop ? elapsed % totalDuration : Math.min(elapsed, totalDuration);
      let frame = 0;
      let nextBoundary = animation.durations[0];
      while (frame < animation.frames.length - 1 && position >= nextBoundary) {
        frame++;
        nextBoundary += animation.durations[frame];
      }
      setCursor((previous) =>
        previous.animation === animation && previous.frame === animation.frames[frame]
          ? previous
          : { animation, frame: animation.frames[frame] },
      );
      if (!animation.loop && frame === animation.frames.length - 1) return;
      timer = setTimeout(advance, Math.max(8, nextBoundary - position));
    };
    setCursor({ animation, frame: animation.frames[0] });
    void decodeSheet(animation.sheet).then(() => {
      if (cancelled) return;
      startedAt = performance.now();
      advance();
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [animation, playing]);
  return {
    frame: playing ? (cursor.animation === animation ? cursor.frame : animation.frames[0]) : animation.still,
    playing,
  };
}
