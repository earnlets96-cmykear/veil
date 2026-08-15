import './styles/veil-design-system.css';
import { SpaceVaultManager } from './spaces/vault.ts';
import { EncryptedSpaceStore } from './storage/spaceStore.ts';
import { SpaceIdentityManager } from './identity/manager.ts';
import { LockManager } from './privacy/lockManager.ts';
import { UIStateManager } from './privacy/uiStateManager.ts';
import type { SpaceSession } from './spaces/session.ts';

// Initialize core VEIL subsystems
const vault = new SpaceVaultManager();
const store = new EncryptedSpaceStore();
const identityManager = new SpaceIdentityManager();
const uiStateManager = new UIStateManager();
const lockManager = new LockManager(vault, uiStateManager);

let activeSession: SpaceSession | null = null;

// App Root Element
const app = document.getElementById('app');

function renderApp() {
  if (!app) return;

  if (!activeSession || !activeSession.isActive()) {
    // Locked State View
    app.innerHTML = `
      <div class="veil-app-container">
        <div class="veil-auth-card">
          <div class="veil-auth-header">
            <div class="veil-logo-icon">🛡️</div>
            <h1 class="veil-title">VEIL</h1>
            <p class="veil-subtitle">Privacy-First Multi-Space Messenger</p>
            <div class="veil-badge veil-badge-rc">v1.0.0-rc.1</div>
          </div>

          <form id="unlock-form" class="veil-form">
            <div class="veil-form-group">
              <label for="unlock-pass" class="veil-label">Enter Space Passphrase / PIN</label>
              <input type="password" id="unlock-pass" class="veil-input" placeholder="••••••••••••" autofocus required />
            </div>
            <button type="submit" id="unlock-btn" class="veil-btn veil-btn-primary">
              Unlock Space
            </button>
          </form>

          <div id="auth-error" class="veil-auth-error" style="display:none;"></div>

          <div class="veil-auth-footer">
            <button id="create-space-btn" class="veil-btn-link">Create New Isolated Space</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('unlock-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const passInput = document.getElementById('unlock-pass') as HTMLInputElement;
      const errorDiv = document.getElementById('auth-error') as HTMLDivElement;
      
      try {
        activeSession = lockManager.unlockSpace(passInput.value);
        renderApp();
      } catch (err: any) {
        errorDiv.textContent = 'Invalid credentials or space not found.';
        errorDiv.style.display = 'block';
        passInput.value = '';
      }
    });

    document.getElementById('create-space-btn')?.addEventListener('click', () => {
      const name = prompt('Space Name (e.g. Personal, Work, Private):', 'Personal');
      if (!name) return;
      const pass = prompt('Choose Passphrase for this Space:');
      if (!pass) return;

      try {
        vault.createSpace({ name, password: pass });
        alert(`Space "${name}" created successfully! Enter its password to unlock.`);
      } catch (err: any) {
        alert(`Failed to create Space: ${err.message}`);
      }
    });

    return;
  }

  // Unlocked State View
  const loaded = identityManager.loadIdentity(activeSession, store);
  const doc = loaded ? loaded.document : identityManager.createIdentity(activeSession, store);

  app.innerHTML = `
    <div class="veil-app-container">
      <div class="veil-space-dashboard">
        <header class="veil-dashboard-header">
          <div class="veil-space-info">
            <div class="veil-space-indicator"></div>
            <div>
              <h2 class="veil-space-title">Space: ${activeSession.name}</h2>
              <p class="veil-space-id">ID: <code>${activeSession.spaceId.substring(0, 16)}...</code></p>
            </div>
          </div>


          <div class="veil-header-actions">
            <button id="quick-lock-btn" class="veil-btn veil-btn-secondary">🔒 Quick Lock</button>
            <button id="panic-lock-btn" class="veil-btn veil-btn-danger">🚨 Panic Lock</button>
          </div>
        </header>

        <main class="veil-dashboard-content">
          <div class="veil-card">
            <h3>Cryptographic Identity</h3>
            <p class="veil-muted">This Space maintains an isolated Ed25519/X25519 identity pair.</p>
            <div class="veil-fingerprint-box">
              <label class="veil-label">Safety Fingerprint</label>
              <div class="veil-fingerprint">${doc.fingerprint}</div>
            </div>
          </div>

          <div class="veil-card">
            <h3>Privacy & E2EE Status</h3>
            <div class="veil-status-grid">
              <div class="veil-status-item">
                <span class="veil-status-label">Multi-Space Isolation</span>
                <span class="veil-badge veil-badge-success">ACTIVE</span>
              </div>
              <div class="veil-status-item">
                <span class="veil-status-label">Blind Mailbox Transport</span>
                <span class="veil-badge veil-badge-success">READY</span>
              </div>
              <div class="veil-status-item">
                <span class="veil-status-label">Double Ratchet E2EE</span>
                <span class="veil-badge veil-badge-success">ENABLED</span>
              </div>
              <div class="veil-status-item">
                <span class="veil-status-label">Metadata Minimization</span>
                <span class="veil-badge veil-badge-success">ENABLED</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  document.getElementById('quick-lock-btn')?.addEventListener('click', () => {
    if (activeSession) {
      lockManager.quickLock(activeSession.spaceId);
      activeSession = null;
    }
    renderApp();
  });

  document.getElementById('panic-lock-btn')?.addEventListener('click', () => {
    lockManager.panicLock();
    activeSession = null;
    renderApp();
  });
}

// First render
renderApp();

console.log('VEIL v1.0.0-rc.1 client initialized.');
