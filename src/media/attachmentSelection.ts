import type { DeviceMediaItem } from './NativeDeviceMediaBridge.ts';

export interface SelectedAttachment {
  id: string;
  file: File;
  uri?: string;
  metadata?: DeviceMediaItem;
}

export function addSelectedAttachments(
  current: SelectedAttachment[],
  incoming: SelectedAttachment[]
): SelectedAttachment[] {
  if (incoming.length === 0) return current;
  const ids = new Set(current.map((item) => item.id));
  let next: SelectedAttachment[] | undefined;
  for (const item of incoming) {
    if (ids.has(item.id)) continue;
    ids.add(item.id);
    (next ||= [...current]).push(item);
  }
  return next || current;
}

export function removeSelectedAttachment(
  current: SelectedAttachment[],
  id: string
): SelectedAttachment[] {
  const index = current.findIndex((item) => item.id === id);
  if (index < 0) return current;
  return [...current.slice(0, index), ...current.slice(index + 1)];
}
