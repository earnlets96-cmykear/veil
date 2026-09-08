/**
 * Tests for Phase 68 Profile Polish:
 * 1. Omission of message bubble avatars in 1-to-1 chats (retained exclusively in groups)
 * 2. Interactive Profile Image Cropper & Resizer (AvatarCropModal)
 * 3. Telegram-Style Multi-Profile Photo Management & Story Dash Indicators
 * 4. Avatar visual fidelity and styling
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar } from '../src/ui/components/ui/Avatar.tsx';
import { AvatarCropModal } from '../src/ui/components/ui/AvatarCropModal.tsx';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 68 — 1-to-1 Chat Bubble Avatar Omission', () => {
  it('ConversationView source code enforces isGroup check before rendering message bubble avatar', () => {
    const convViewContent = fs.readFileSync(
      path.join(rootDir, 'src/ui/components/ConversationView.tsx'),
      'utf-8'
    );

    // Verify avatar container is conditioned on isGroup && !msg.isOutgoing
    expect(convViewContent).toContain('{isGroup && !msg.isOutgoing && (');
    expect(convViewContent).not.toMatch(/\{!msg\.isOutgoing\s*&&\s*\(\s*<div[^>]*>\s*\{!isGroupedWithNext/);
  });
});

describe('Phase 68 — Avatar Crop Modal & Visual Fidelity', () => {
  it('Avatar component sets background-size: cover, center position, and no-repeat', () => {
    const html = renderToStaticMarkup(
      <Avatar
        name="Test User"
        imageUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        size="md"
      />
    );

    expect(html).toContain('veil-avatar');
    expect(html).toContain('background-size:cover');
    expect(html).toContain('background-position:center');
    expect(html).toContain('background-repeat:no-repeat');
  });

  it('AvatarCropModal renders viewport, zoom controls, and action buttons', () => {
    const html = renderToStaticMarkup(
      <AvatarCropModal
        imageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        onCropComplete={() => {}}
        onCancel={() => {}}
      />
    );

    expect(html).toContain('veil-crop-viewport');
    expect(html).toContain('Edit Profile Photo');
    expect(html).toContain('Rotate 90°');
    expect(html).toContain('Set Profile Photo');
    expect(html).toContain('type="range"');
    expect(html).toContain('aria-label="Zoom scale"');
  });
});

describe('Phase 68 — Telegram-Style Multi-Profile Photos Architecture', () => {
  it('UserPrivacySettings interface includes profilePhotos array', () => {
    const typesContent = fs.readFileSync(path.join(rootDir, 'src/ui/app/types.ts'), 'utf-8');
    expect(typesContent).toContain('profilePhotos?: string[];');
  });

  it('AppState exposes addProfilePhoto, setMainProfilePhoto, and deleteProfilePhoto', () => {
    const appStateContent = fs.readFileSync(path.join(rootDir, 'src/ui/app/AppState.tsx'), 'utf-8');
    expect(appStateContent).toContain('addProfilePhoto: (avatarDataUrl: string) => Promise<void>;');
    expect(appStateContent).toContain('setMainProfilePhoto: (photoUrl: string) => Promise<void>;');
    expect(appStateContent).toContain('deleteProfilePhoto: (photoUrl: string) => Promise<void>;');

    // Verify implementation in context value
    expect(appStateContent).toContain('addProfilePhoto,');
    expect(appStateContent).toContain('setMainProfilePhoto,');
    expect(appStateContent).toContain('deleteProfilePhoto,');
  });

  it('ProfileModal integrates multi-profile story dashes and cropper modal', () => {
    const profileModalContent = fs.readFileSync(
      path.join(rootDir, 'src/ui/components/ProfileModal.tsx'),
      'utf-8'
    );

    // Verify story indicators
    expect(profileModalContent).toContain('veil-profile-story-dashes');
    expect(profileModalContent).toContain('availablePhotos.length > 1');
    expect(profileModalContent).toContain('AvatarCropModal');
    expect(profileModalContent).toContain('Set as Main Photo');
    expect(profileModalContent).toContain('Delete Photo');
  });

  it('SettingsModal integrates AvatarCropModal', () => {
    const settingsModalContent = fs.readFileSync(
      path.join(rootDir, 'src/ui/components/SettingsModal.tsx'),
      'utf-8'
    );

    expect(settingsModalContent).toContain('AvatarCropModal');
    expect(settingsModalContent).toContain('cropModalImage');
  });
});
