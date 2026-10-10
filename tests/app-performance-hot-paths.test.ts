import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const appSource = fs.readFileSync(path.resolve(__dirname, '../src/ui/App.tsx'), 'utf8');
const sidebarSource = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/Sidebar.tsx'), 'utf8');

describe('app performance hot paths', () => {
  it('defers secondary modal screens until they are requested', () => {
    for (const [component, file] of [
      ['NewChatModal', 'NewChatModal'],
      ['NewGroupModal', 'NewGroupModal'],
      ['GroupDetailsModal', 'GroupDetailsModal'],
      ['ContactDetailsModal', 'ContactDetailsModal'],
      ['SettingsModal', 'SettingsModal'],
      ['ProfileModal', 'ProfileModal'],
      ['AppLockSetupModal', 'AppLockSetupModal'],
      ['AccountsAndSpacesModal', 'AccountsAndSpacesModal'],
      ['SocialVideoShareDialog', 'SocialVideoShareDialog'],
    ]) {
      expect(appSource, `${component} should not be a static import`).not.toMatch(
        new RegExp(`import\\s+\\{[^}]*\\b${component}\\b[^}]*\\}\\s+from`),
      );
      expect(appSource, `${component} should be lazy loaded`).toContain(
        `React.lazy(() => import('./components/${file}.tsx')`,
      );
    }

    expect(appSource).toContain('<React.Suspense fallback={null}>');
    expect(appSource).toContain("import { CreateSpaceModal } from './components/CreateSpaceModal.tsx';");
    expect(appSource).toContain("import { RestoreAccountModal } from './components/RestoreAccountModal.tsx';");
  });

  it('precomputes contact avatar lookup instead of scanning contacts for every chat row', () => {
    expect(sidebarSource).toContain('contactAvatarById');
    expect(sidebarSource).toMatch(/contactAvatarById\.get\(conv\.id\)/);
    expect(sidebarSource).not.toMatch(/contacts\s*\.find\(\(c\)\s*=>\s*c\.identityId\s*===\s*conv\.id\)/);
  });
});
