export const CHAT_BACK_EDGE_PX = 24;
export const CHAT_BACK_TRIGGER_PX = 72;
export const MEDIA_DISMISS_TRIGGER_PX = 120;

export interface ConversationBackSwipe {
  startX: number;
  viewportWidth: number;
  deltaX: number;
  deltaY: number;
  direction: 'ltr' | 'rtl';
}

export interface MediaDismissDrag {
  deltaX: number;
  deltaY: number;
  zoom: number;
}

export function shouldCompleteConversationBackSwipe({
  startX,
  viewportWidth,
  deltaX,
  deltaY,
  direction,
}: ConversationBackSwipe): boolean {
  const startsAtLogicalEdge =
    direction === 'rtl'
      ? startX >= viewportWidth - CHAT_BACK_EDGE_PX
      : startX <= CHAT_BACK_EDGE_PX;
  const movesTowardLogicalBack = direction === 'rtl' ? deltaX <= -CHAT_BACK_TRIGGER_PX : deltaX >= CHAT_BACK_TRIGGER_PX;

  return startsAtLogicalEdge && movesTowardLogicalBack && Math.abs(deltaX) > Math.abs(deltaY);
}

export function shouldDismissMediaByDrag({ deltaX, deltaY, zoom }: MediaDismissDrag): boolean {
  return zoom <= 1 && deltaY >= MEDIA_DISMISS_TRIGGER_PX && deltaY > Math.abs(deltaX);
}
