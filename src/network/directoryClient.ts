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

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Registers a signed profile document with the directory server.
   */
  public async registerProfile(profile: SignedProfileDocument): Promise<RegisterProfileResponse> {
    const url = `${this.baseUrl}/v1/directory/register`;
    const payload: RegisterProfileRequest = { profile };

    const res = await fetch(url, {
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
    const url = `${this.baseUrl}/v1/directory/update`;
    const payload: RegisterProfileRequest = { profile };

    const res = await fetch(url, {
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
    const q = query.trim();
    if (!q || q.length < 3) {
      return [];
    }

    const url = `${this.baseUrl}/v1/directory/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
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

    const url = `${this.baseUrl}/v1/directory/profile/${encodeURIComponent(canonical)}`;
    const res = await fetch(url, {
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

    const url = `${this.baseUrl}/v1/directory/identity/${encodeURIComponent(cleanId)}`;
    const res = await fetch(url, {
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
