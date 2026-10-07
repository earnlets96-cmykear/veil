import { useEffect, useRef } from 'react';

type FrameRef = { current: number | null };

export function scheduleTextareaResize(
  textarea: HTMLTextAreaElement,
  frameRef: FrameRef,
  requestFrame: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  maxHeight = 140
): void {
  if (frameRef.current !== null) return;

  frameRef.current = requestFrame(() => {
    frameRef.current = null;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  });
}

export function useTextareaAutoResize(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeight = 140
): void {
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    scheduleTextareaResize(textarea, frameRef, requestAnimationFrame, maxHeight);
  }, [textareaRef, value, maxHeight]);

  useEffect(() => () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }
  }, []);
}
