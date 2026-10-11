import type { Contact } from '../contacts/types.ts';
import type { SignedProfileDocument } from '../identity/profile.ts';
import { verifySignedProfile } from '../identity/profile.ts';
import { verifyIdentityDocument } from '../identity/document.ts';

export interface MediaRecipientProfileLookup {
  getProfileByIdentity(identityId: string): Promise<SignedProfileDocument | null>;
  getProfileByUsername(username: string): Promise<SignedProfileDocument | null>;
}

/** Resolve a direct-media recipient before attachment encryption or upload starts. */
export async function resolveMediaRecipientProfile(
  conversationId: string,
  contact: Pick<Contact, 'identityId' | 'accountUsername' | 'name' | 'signingPublicKey'> | null | undefined,
  directory: MediaRecipientProfileLookup
): Promise<SignedProfileDocument | null> {
  const expectedIdentityId = contact?.identityId || (conversationId.startsWith('@') ? undefined : conversationId);
  const knownSigningKey = contact?.signingPublicKey;
  const identityLookups = [...new Set([contact?.identityId, expectedIdentityId].filter((value): value is string => Boolean(value)))];
  const usernames = [...new Set([
    contact?.accountUsername,
    contact?.name?.replace(/^@/, '').trim(),
    conversationId.startsWith('@') ? conversationId.slice(1).trim() : undefined,
  ].filter((value): value is string => Boolean(value)))];

  for (const identityId of identityLookups) {
    const profile = await directory.getProfileByIdentity(identityId).catch(() => null);
    if (isTrustedProfile(profile, expectedIdentityId, knownSigningKey)) return profile;
  }

  for (const username of usernames) {
    const profile = await directory.getProfileByUsername(username).catch(() => null);
    if (isTrustedProfile(profile, expectedIdentityId, knownSigningKey)) return profile;
  }

  return null;
}

function isTrustedProfile(
  profile: SignedProfileDocument | null,
  expectedIdentityId: string | undefined,
  knownSigningKey: string | undefined
): profile is SignedProfileDocument {
  if (!profile || (expectedIdentityId && profile.identityId !== expectedIdentityId)) return false;
  const identityDocument = profile.prekeyBundle?.identityDocument;
  const profileSigningKey = identityDocument?.signingPublicKey;
  if (!identityDocument || identityDocument.identityId !== profile.identityId || !verifyIdentityDocument(identityDocument)) return false;
  if (!profileSigningKey || (knownSigningKey && profileSigningKey !== knownSigningKey)) return false;
  return verifySignedProfile(profile, knownSigningKey);
}
