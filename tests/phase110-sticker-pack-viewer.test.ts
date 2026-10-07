import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

describe('Phase 110: sticker pack viewer is distinct from media viewing', () => {
  it('routes sticker taps to the dedicated pack viewer', () => {
    const conversation = read('src/ui/components/ConversationView.tsx');
    expect(conversation).toContain('onOpenStickerPack');
    expect(conversation).toMatch(/if \(isSticker\) onOpenStickerPack\(msg\)/);
  });

  it('offers a separate View Sticker Pack action in message actions', () => {
    const conversation = read('src/ui/components/ConversationView.tsx');
    expect(conversation).toContain('<span>View Sticker Pack</span>');
    expect(conversation).toContain('<span>Add sticker pack</span>');
  });

  it('opens the existing pack preview with the selected pack preloaded', () => {
    const conversation = read('src/ui/components/ConversationView.tsx');
    const modal = read('src/ui/components/stickers/AddStickerPackModal.tsx');
    expect(conversation).toContain('initialPack={stickerPackViewer}');
    expect(modal).toContain('initialPack?: StickerPack | null');
    expect(modal).toContain('setPreviewPack(initialPack)');
  });
});
