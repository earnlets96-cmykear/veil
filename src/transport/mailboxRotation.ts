/**
 * Mailbox Token & Capability Rotation Engine for VEIL Phase 8.
 *
 * Implements epoch-based mailbox capability rotation with overlapping
 * grace periods to prevent compromise of old tokens from exposing future access.
 */

import { generateCapability, verifyCapability } from './capability.ts';

export interface MailboxEpochState {
  mailboxId: string;
  epoch: number;
  currentCapability: string;
  currentVerifier: string;
  previousCapability?: string;
  previousVerifier?: string;
  rotatedAt: number;
}

export class MailboxRotationManager {
  private mailboxEpochs = new Map<string, MailboxEpochState>();

  /**
   * Initializes a new mailbox with epoch 1.
   */
  public initializeMailbox(mailboxId: string): MailboxEpochState {
    const { capability, verifier } = generateCapability();
    const state: MailboxEpochState = {
      mailboxId,
      epoch: 1,
      currentCapability: capability,
      currentVerifier: verifier,
      rotatedAt: Date.now(),
    };
    this.mailboxEpochs.set(mailboxId, state);
    return state;
  }

  /**
   * Rotates a mailbox's capability secret to the next epoch.
   * Retains the previous capability in a grace period.
   */
  public rotateMailbox(mailboxId: string): MailboxEpochState {
    const current = this.mailboxEpochs.get(mailboxId);
    if (!current) {
      return this.initializeMailbox(mailboxId);
    }

    const { capability: newCap, verifier: newVer } = generateCapability();

    const nextState: MailboxEpochState = {
      mailboxId,
      epoch: current.epoch + 1,
      currentCapability: newCap,
      currentVerifier: newVer,
      previousCapability: current.currentCapability,
      previousVerifier: current.currentVerifier,
      rotatedAt: Date.now(),
    };

    this.mailboxEpochs.set(mailboxId, nextState);
    return nextState;
  }

  /**
   * Verifies if a presented capability is valid for the current epoch OR grace period.
   */
  public authenticateCapability(mailboxId: string, capability: string): boolean {
    const state = this.mailboxEpochs.get(mailboxId);
    if (!state) return false;

    // 1. Check current epoch
    if (verifyCapability(capability, state.currentVerifier)) {
      return true;
    }

    // 2. Check grace period (previous epoch)
    if (state.previousVerifier && verifyCapability(capability, state.previousVerifier)) {
      return true;
    }

    return false;
  }

  /**
   * Gets the active capability state.
   */
  public getState(mailboxId: string): MailboxEpochState | undefined {
    return this.mailboxEpochs.get(mailboxId);
  }
}
