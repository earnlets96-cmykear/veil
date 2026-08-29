/**
 * Accessible Message Delivery Status Indicator Component for VEIL.
 *
 * Status Semantics:
 * - QUEUED: Stored locally, awaiting network (clock icon)
 * - SENDING: Transmission in progress (spinning refresh icon)
 * - UPLOADING: File/media encryption + upload in progress (spinning refresh icon)
 * - SENT_TO_RELAY: Delivered to relay server — single gray check
 * - DELIVERED_TO_RECIPIENT: Recipient device received — double gray checks
 * - READ: Recipient opened conversation — double accent-colored checks
 * - FAILED: Delivery failed (alert icon)
 */

import React from 'react';
import { ClockIcon, CheckIcon, CheckCheckIcon, AlertCircleIcon, RefreshCwIcon } from '../icons/index.ts';

export type DeliveryStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'UPLOADING'
  | 'SENT_TO_RELAY'
  | 'DELIVERED_TO_RECIPIENT'
  | 'READ'
  | 'PROCESSED'
  | 'FAILED'
  | string;

export interface MessageStatusProps {
  status: DeliveryStatus;
  className?: string;
  size?: number;
}

export const MessageStatus: React.FC<MessageStatusProps> = ({ status, className = '', size = 15 }) => {
  switch (status) {
    case 'QUEUED':
      return (
        <span className={`veil-msg-status ${className}`.trim()} title="Queued locally (Offline)" aria-label="Queued locally">
          <ClockIcon size={size} color="var(--veil-text-muted)" />
        </span>
      );
    case 'SENDING':
    case 'UPLOADING':
      return (
        <span className={`veil-msg-status ${className}`.trim()} title={status === 'UPLOADING' ? 'Uploading...' : 'Sending...'} aria-label={status === 'UPLOADING' ? 'Uploading' : 'Sending'}>
          <RefreshCwIcon size={size} className="veil-spin" color="var(--veil-text-muted)" />
        </span>
      );
    case 'SENT_TO_RELAY':
      return (
        <span className={`veil-msg-status ${className}`.trim()} title="Sent" aria-label="Sent to relay">
          <CheckIcon size={size} color="var(--veil-text-muted)" />
        </span>
      );
    case 'DELIVERED_TO_RECIPIENT':
    case 'PROCESSED':
      return (
        <span className={`veil-msg-status ${className}`.trim()} title="Delivered & Read" aria-label="Delivered to recipient">
          <CheckCheckIcon size={size} color="var(--veil-text-secondary)" />
        </span>
      );
    case 'READ':
      return (
        <span className={`veil-msg-status ${className}`.trim()} title="Read" aria-label="Read by recipient">
          <CheckCheckIcon size={size} color="var(--veil-accent-secondary, #5ab4d4)" />
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={`veil-msg-status ${className}`.trim()}
          title="Failed to deliver"
          aria-label="Failed to deliver"
        >
          <AlertCircleIcon size={size} color="var(--veil-danger)" />
        </span>
      );
    default:
      return null;
  }
};
