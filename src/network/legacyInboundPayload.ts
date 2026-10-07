export type LegacyInboundPayload = Record<string, any> & { conversationId: string };

export function parseLegacyInboundPayload(payload: string): LegacyInboundPayload | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.conversationId !== 'string' || !candidate.conversationId) return null;
    if (!candidate.text && !candidate.attachment && !candidate.voice) return null;

    return candidate as LegacyInboundPayload;
  } catch {
    return null;
  }
}
