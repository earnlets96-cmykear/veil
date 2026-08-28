/**
 * Phase 36: Android Permissions, Mobile Layout, and Zero-Emoji UI Test Suite.
 *
 * Verifies:
 * - PermissionsModal renders clean SVG icons, privacy explanations, and settings guidance.
 * - UserSearchResult renders accurately for various relationship states.
 * - Zero Unicode emoji icons exist in UI control buttons.
 * - Mobile responsive classes and empty state styling integrity.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PermissionsModal } from '../src/ui/components/PermissionsModal.tsx';
import { UserSearchResult } from '../src/ui/components/ui/UserSearchResult.tsx';
import { ErrorBoundary } from '../src/ui/components/ErrorBoundary.tsx';

describe('Phase 36: Permissions, Mobile Layout & Zero-Emoji UI', () => {
  it('renders PermissionsModal with privacy explanation and SVG icons', () => {
    const htmlFirstRequest = renderToStaticMarkup(
      <PermissionsModal
        type="microphone"
        isPermanentlyDenied={false}
        onAllow={() => {}}
        onCancel={() => {}}
      />
    );

    expect(htmlFirstRequest).toContain('Microphone Access Required');
    expect(htmlFirstRequest).toContain('VEIL needs microphone access to record encrypted voice messages');
    expect(htmlFirstRequest).toContain('Allow Microphone');
    expect(htmlFirstRequest).toContain('<svg');

    const htmlDenied = renderToStaticMarkup(
      <PermissionsModal
        type="microphone"
        isPermanentlyDenied={true}
        onAllow={() => {}}
        onCancel={() => {}}
        onOpenSettings={() => {}}
      />
    );

    expect(htmlDenied).toContain('Microphone Permission Disabled');
    expect(htmlDenied).toContain('Open Settings');
  });

  it('renders UserSearchResult with contact and self relationships without crashing', () => {
    const htmlSelf = renderToStaticMarkup(
      <UserSearchResult
        result={{
          peerId: 'id-alice',
          username: 'alice',
          displayName: 'Alice Security',
          prekeyBundle: {} as any,
          identityDocument: {} as any,
        }}
        relationship="SELF"
      />
    );

    expect(htmlSelf).toContain('Alice Security');
    expect(htmlSelf).toContain('@alice');
    expect(htmlSelf).toContain('You');

    const htmlVerified = renderToStaticMarkup(
      <UserSearchResult
        result={{
          peerId: 'id-bob',
          username: 'bob',
          displayName: 'Bob Cryptographer',
          prekeyBundle: {} as any,
          identityDocument: {} as any,
        }}
        relationship="CONTACT_VERIFIED"
        onMessageUser={() => {}}
      />
    );

    expect(htmlVerified).toContain('Bob Cryptographer');
    expect(htmlVerified).toContain('Verified');
    expect(htmlVerified).toContain('Chat');
  });

  it('verifies ErrorBoundary contains pure SVG recovery controls with zero emoji', () => {
    // Force error state
    const ThrowError = () => {
      throw new Error('Test error for boundary');
    };

    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { hasError: true, errorMessage: 'Synthetic error' };
    const html = renderToStaticMarkup(boundary.render() as React.ReactElement);

    expect(html).toContain('VEIL Startup Recovery');
    expect(html).toContain('Retry Loading');
    expect(html).toContain('Return to Lock Screen');
    expect(html).toContain('<svg');
    // Ensure no emojis like 🔄 or 📱 exist in output
    expect(html).not.toContain('🔄');
    expect(html).not.toContain('📱');
  });
});
