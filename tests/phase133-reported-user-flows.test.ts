import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isSelfVaultIdentity } from '../src/ui/utils/selfVault.ts';

const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Phase 133 reported user flows', () => {
  it('offers group creation from the new conversation flow and supports creating before inviting members', () => {
    const newChat = read('src/ui/components/NewChatModal.tsx');
    const newGroup = read('src/ui/components/NewGroupModal.tsx');

    expect(newChat).toContain("openModal({ type: 'newGroup' })");
    expect(newGroup).toContain('Add members now or later');
    expect(newGroup).not.toContain('selectedMembers.length === 0 || isSubmitting');
    expect(newGroup).not.toContain('disabled={!name.trim() || selectedMembers.length === 0}');
  });

  it('routes the current user to My Vault and never sends a contact request to the same identity', () => {
    const newChat = read('src/ui/components/NewChatModal.tsx');
    const appState = read('src/ui/app/AppState.tsx');

    expect(newChat).toContain('selectConversation(myProfile.identityId)');
    expect(appState).toMatch(/const sendContactRequest = useCallback\([\s\S]{0,700}myProfile\?\.identityId[\s\S]{0,300}Cannot send a contact request to yourself/);
  });

  it('stores messages to the active identity as local encrypted Space data without relay delivery', () => {
    const appState = read('src/ui/app/AppState.tsx');
    const sendMessage = appState.slice(appState.indexOf('const sendMessage = useCallback'), appState.indexOf('const pendingNotificationRepliesRef'));

    expect(sendMessage).toMatch(/const isSelfVault = isSelfVaultIdentity\(conversationId, myIdentityId\)[\s\S]*?status: isSelfVault \? 'PROCESSED'[\s\S]*?store\.setAsync\(activeSession, 'veil:ui:messages'[\s\S]*?if \(isSelfVault\) return;/);
    expect(sendMessage).toContain('return;');
  });

  it('matches only the active Space identity for My Vault', () => {
    expect(isSelfVaultIdentity('identity-space-a', 'identity-space-a')).toBe(true);
    expect(isSelfVaultIdentity('identity-space-a', 'identity-space-b')).toBe(false);
    expect(isSelfVaultIdentity('identity-space-a', undefined)).toBe(false);
  });

  it('does not retain another full plaintext video buffer in the decrypted media cache during upload', () => {
    const appState = read('src/ui/app/AppState.tsx');
    const sendAttachments = appState.slice(appState.indexOf('const sendAttachments ='), appState.indexOf('const sendAttachment ='));

    expect(sendAttachments).not.toContain('data: fileBytes');
    expect(sendAttachments).toContain('fileBytes.fill(0)');
  });

  it('zeroizes worker plaintext and the temporary media key after encryption', () => {
    const worker = read('src/attachments/mediaWorker.ts');
    const transfer = read('src/attachments/mediaTransfer.ts');
    const encryptCase = worker.slice(worker.indexOf("case 'CHUNK_AND_ENCRYPT'"), worker.indexOf("case 'DECRYPT_AND_REASSEMBLE'"));

    expect(encryptCase).toContain('zeroize(dataBytes)');
    expect(encryptCase).toContain('finally');
    expect(transfer).toContain('encryptionKey.fill(0)');
  });

  it('caps Android plugin media reads to one MiB and removes the whole-file Base64 endpoint', () => {
    const nativeMedia = read('android/app/src/main/java/chat/veil/app/VeilDeviceMediaPlugin.kt');

    expect(nativeMedia).toContain('fun readMediaChunk(call: PluginCall)');
    expect(nativeMedia).toContain('requestedLength !in 1..(1024 * 1024)');
    expect(nativeMedia).not.toContain('fun readMedia(call: PluginCall)');
    expect(nativeMedia).not.toContain('input.copyTo(output)');
  });

  it('keeps sequential native chunks on one background media stream and skips video thumbnail decoding', () => {
    const nativeMedia = read('android/app/src/main/java/chat/veil/app/VeilDeviceMediaPlugin.kt');
    const readChunk = nativeMedia.slice(nativeMedia.indexOf('fun readMediaChunk'), nativeMedia.indexOf('fun pickDocuments'));

    expect(readChunk).toContain('mediaExecutor.execute');
    expect(readChunk).toContain('previous.nextOffset == offset');
    expect(nativeMedia).toContain('val thumb = if (mime.startsWith("image/")) thumbnailFor(itemUri) else null');
  });
});
