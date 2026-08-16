/**
 * Contact Manager for VEIL.
 *
 * Provides Space-isolated contact storage, lifecycle management, and safety verification.
 */

import { Contact, InvitationPayload, VerificationStatus } from './types.ts';
import { SpaceSession } from '../spaces/session.ts';
import { EncryptedSpaceStore } from '../storage/spaceStore.ts';

const CONTACTS_STORAGE_KEY = 'veil:contacts:list';

export class ContactManager {
  private store: EncryptedSpaceStore;

  constructor(store: EncryptedSpaceStore) {
    this.store = store;
  }

  public async listContacts(session: SpaceSession): Promise<Contact[]> {
    const list = await this.store.getAsync<Contact[]>(session, CONTACTS_STORAGE_KEY);
    return list || [];
  }

  public async getContact(session: SpaceSession, identityId: string): Promise<Contact | null> {
    const contacts = await this.listContacts(session);
    return contacts.find((c) => c.identityId === identityId) || null;
  }

  public async addContactFromInvitation(
    session: SpaceSession,
    invitation: InvitationPayload
  ): Promise<Contact> {
    const contacts = await this.listContacts(session);

    const existingIdx = contacts.findIndex((c) => c.identityId === invitation.identityId);
    const newContact: Contact = {
      identityId: invitation.identityId,
      name: invitation.name || invitation.identityId.slice(0, 10),
      fingerprint: invitation.fingerprint,
      signingPublicKey: invitation.signingPublicKey,
      keyAgreementPublicKey: invitation.keyAgreementPublicKey,
      status: 'ACCEPTED',
      verificationStatus: 'UNVERIFIED',
      addedAt: Date.now(),
      prekeyBundle: invitation.prekeyBundle,
      mailboxId: invitation.mailboxId,
    };

    if (existingIdx >= 0) {
      contacts[existingIdx] = {
        ...contacts[existingIdx],
        ...newContact,
        addedAt: contacts[existingIdx].addedAt, // preserve original timestamp
      };
    } else {
      contacts.push(newContact);
    }

    await this.store.setAsync(session, CONTACTS_STORAGE_KEY, contacts);
    return newContact;
  }

  public async updateVerification(
    session: SpaceSession,
    identityId: string,
    verificationStatus: VerificationStatus
  ): Promise<Contact> {
    const contacts = await this.listContacts(session);
    const contact = contacts.find((c) => c.identityId === identityId);
    if (!contact) {
      throw new Error(`Contact not found: ${identityId}`);
    }

    contact.verificationStatus = verificationStatus;
    await this.store.setAsync(session, CONTACTS_STORAGE_KEY, contacts);
    return contact;
  }

  public async blockContact(session: SpaceSession, identityId: string): Promise<void> {
    const contacts = await this.listContacts(session);
    const contact = contacts.find((c) => c.identityId === identityId);
    if (contact) {
      contact.status = 'BLOCKED';
      await this.store.setAsync(session, CONTACTS_STORAGE_KEY, contacts);
    }
  }

  public async unblockContact(session: SpaceSession, identityId: string): Promise<void> {
    const contacts = await this.listContacts(session);
    const contact = contacts.find((c) => c.identityId === identityId);
    if (contact) {
      contact.status = 'ACCEPTED';
      await this.store.setAsync(session, CONTACTS_STORAGE_KEY, contacts);
    }
  }

  public async deleteContact(session: SpaceSession, identityId: string): Promise<void> {
    const contacts = await this.listContacts(session);
    const filtered = contacts.filter((c) => c.identityId !== identityId);
    await this.store.setAsync(session, CONTACTS_STORAGE_KEY, filtered);
  }
}
