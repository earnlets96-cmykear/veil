/** A self vault is strictly scoped to the active Space's own identity. */
export function isSelfVaultIdentity(conversationIdentityId: string, activeIdentityId?: string | null): boolean {
  return Boolean(activeIdentityId && conversationIdentityId === activeIdentityId);
}
