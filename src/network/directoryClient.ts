/**
 * Directory HTTP Client for VEIL.
 *
 * Communicates with the untrusted relay directory endpoints for username registration,
 * profile updates, anti-enumeration directory searches, and profile fetching.
 */

import { SignedProfileDocument } from '../identity/profile.ts';
import {
  RegisterProfileRequest,
  RegisterProfileResponse,
  DirectorySearchResult,
  DirectorySearchResponse,
  DirectoryProfileResponse,
} from '../server/types.ts';

export class DirectoryClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl: string, timeoutMs = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Registers a signed profile document with the directory server.
   */
  public async registerProfile(profile: SignedProfileDocument): Promise<RegisterProfileResponse> {
    const payload: RegisterProfileRequest = { profile };

    const res = await this.request('/v1/directory/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || `Directory register failed with HTTP ${res.status}`);
    }

    return (await res.json()) as RegisterProfileResponse;
  }

  /**
   * Updates an existing profile for the authenticated identity.
   */
  public async updateProfile(profile: SignedProfileDocument): Promise<RegisterProfileResponse> {
    const payload: RegisterProfileRequest = { profile };

    const res = await this.request('/v1/directory/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || `Directory update failed with HTTP ${res.status}`);
    }

    return (await res.json()) as RegisterProfileResponse;
  }

  /**
   * Searches the public directory by username or display name with anti-enumeration constraints.
   */
  public async searchProfiles(query: string): Promise<DirectorySearchResult[]> {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q || q.length < 1) {
      return [];
    }

    const res = await this.request(`/v1/directory/search?q=${encodeURIComponent(q)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      if (res.status === 400) return [];
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || `Directory search failed with HTTP ${res.status}`);
    }

    const data = (await res.json()) as DirectorySearchResponse;
    return data.results || [];
  }

  /**
   * Fetches the complete signed profile document (including mailbox and prekey bundle) for a username.
   */
  public async getProfileByUsername(username: string): Promise<SignedProfileDocument | null> {
    const canonical = username.trim().toLowerCase().replace(/^@/, '');
    if (!canonical) return null;

    const res = await this.request(`/v1/directory/profile/${encodeURIComponent(canonical)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || `Directory getProfile failed with HTTP ${res.status}`);
    }

    const data = (await res.json()) as DirectoryProfileResponse;
    return data.profile || null;
  }

  /**
   * Fetches the complete signed profile document by cryptographic identity ID.
   */
  public async getProfileByIdentity(identityId: string): Promise<SignedProfileDocument | null> {
    const cleanId = identityId.trim();
    if (!cleanId) return null;

    const res = await this.request(`/v1/directory/identity/${encodeURIComponent(cleanId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || `Directory getProfileByIdentity failed with HTTP ${res.status}`);
    }

    const data = (await res.json()) as DirectoryProfileResponse;
    return data.profile || null;
  }
}
