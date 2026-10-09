import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SocialVideoShareDialog } from '../src/ui/components/SocialVideoShareDialog.tsx';
import { UIConversation } from '../src/ui/app/types.ts';
import { parseSocialVideoUrl } from '../src/media/socialVideoLinks.ts';

const conversations: UIConversation[] = [
  { id: 'peer-alice', type: 'direct', name: 'Alice', avatarSeed: 'alice', unreadCount: 0 },
  { id: 'grp-family', type: 'group', name: 'Family', avatarSeed: 'family', unreadCount: 0 },
];

describe('Phase 125 share-to-chat dialog', () => {
  it('shows the normalized link, direct and group recipients, and requires recipient selection', () => {
    const link = parseSocialVideoUrl('https://www.tiktok.com/@creator/video/7351234567890123456?tracking=1')!;
    const html = renderToStaticMarkup(
      <SocialVideoShareDialog
        link={link}
        conversations={conversations}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Share video');
    expect(html).toContain('https://www.tiktok.com/@creator/video/7351234567890123456');
    expect(html).toContain('Alice');
    expect(html).toContain('Family');
    expect(html).toContain('Select a conversation');
    expect(html).toMatch(/button[^>]*disabled=""[^>]*>Send video/);
  });

  it('explains when no chat is available without exposing a send action', () => {
    const link = parseSocialVideoUrl('https://www.instagram.com/reel/C7abc_12/')!;
    const html = renderToStaticMarkup(
      <SocialVideoShareDialog link={link} conversations={[]} onSend={vi.fn()} onClose={vi.fn()} />
    );

    expect(html).toContain('You need a chat before sharing this video');
    expect(html).not.toMatch(/>Send video</);
  });
});
