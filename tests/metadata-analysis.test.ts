import { describe, it, expect } from 'vitest';
import { MessagePadding } from '../src/privacy/padding.ts';
import { MailboxRotationManager } from '../src/transport/mailboxRotation.ts';

describe('VEIL Phase 8: Traffic Analysis Test Harness & Mailbox Rotation Tests', () => {
  it('SIZE ANALYSIS: Padded messages prevent exact length deduction by wire observers', () => {
    const samples = [
      'yes',
      'no',
      'hello there',
      'how are you doing today?',
      'Let us meet at 5pm tomorrow to discuss the confidential plans for project X.',
    ];

    const paddedLengths = new Set<number>();
    for (const msg of samples) {
      const padded = MessagePadding.padMessage(msg);
      paddedLengths.add(padded.length);
    }

    // All sample messages under 510 bytes collapse into the identical 512-byte size bucket
    expect(paddedLengths.size).toBe(1);
    expect(paddedLengths.has(512)).toBe(true);
  });

  it('MAILBOX CAPABILITY ROTATION: Grace period allows previous epoch and expires older epochs', () => {
    const rotationMgr = new MailboxRotationManager();
    const mbId = 'mb_rot_01';

    // 1. Epoch 1
    const epoch1 = rotationMgr.initializeMailbox(mbId);
    expect(epoch1.epoch).toBe(1);
    expect(rotationMgr.authenticateCapability(mbId, epoch1.currentCapability)).toBe(true);

    // 2. Rotate to Epoch 2
    const epoch2 = rotationMgr.rotateMailbox(mbId);
    expect(epoch2.epoch).toBe(2);
    expect(rotationMgr.authenticateCapability(mbId, epoch2.currentCapability)).toBe(true);
    // Epoch 1 capability still valid in grace period
    expect(rotationMgr.authenticateCapability(mbId, epoch1.currentCapability)).toBe(true);

    // 3. Rotate to Epoch 3
    const epoch3 = rotationMgr.rotateMailbox(mbId);
    expect(epoch3.epoch).toBe(3);
    expect(rotationMgr.authenticateCapability(mbId, epoch3.currentCapability)).toBe(true);
    // Epoch 2 capability valid in grace period
    expect(rotationMgr.authenticateCapability(mbId, epoch2.currentCapability)).toBe(true);
    // Epoch 1 capability is now EXPIRED and rejected
    expect(rotationMgr.authenticateCapability(mbId, epoch1.currentCapability)).toBe(false);
  });
});
