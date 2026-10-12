import { describe, expect, it } from 'vitest';
import { addSelectedAttachments, removeSelectedAttachment, type SelectedAttachment } from '../src/media/attachmentSelection.ts';

const item = (id: string): SelectedAttachment => ({
  id,
  file: new File([], `${id}.bin`, { type: 'application/octet-stream' }),
});

describe('canonical attachment selection', () => {
  it('adds multiple file types once and preserves selection order across category views', () => {
    const selected = addSelectedAttachments([], [item('image'), item('video'), item('pdf')]);
    const afterReturningFromDocuments = addSelectedAttachments(selected, [item('video'), item('document')]);

    expect(afterReturningFromDocuments.map(({ id }) => id)).toEqual(['image', 'video', 'pdf', 'document']);
    expect(afterReturningFromDocuments).toHaveLength(4);
  });

  it('keeps picker cancellation and repeated empty results from changing the current selection', () => {
    const selected = addSelectedAttachments([], [item('existing')]);
    expect(addSelectedAttachments(selected, [])).toBe(selected);
    expect(addSelectedAttachments(selected, [item('existing')])).toBe(selected);
    expect(selected.map(({ id }) => id)).toEqual(['existing']);
  });

  it('removes only the selected item and leaves unrelated pending records intact', () => {
    const selected = addSelectedAttachments([], [item('photo'), item('large-video'), item('archive')]);
    expect(removeSelectedAttachment(selected, 'large-video').map(({ id }) => id)).toEqual(['photo', 'archive']);
    expect(removeSelectedAttachment(selected, 'missing')).toBe(selected);
  });
});
