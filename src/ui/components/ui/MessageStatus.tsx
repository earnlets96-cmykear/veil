/**
 * Accessible Message Delivery Status Indicator Component for VEIL.
 * Uses crisp SVG delivery ticks and status glyphs.
 */

import React from 'react';
import { ClockIcon, CheckIcon, CheckCheckIcon, AlertCircleIcon, RefreshCwIcon } from '../icons/index.ts';

export type DeliveryStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT_TO_RELAY'
  | 'DELIVERED_TO_RECIPIENT'
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
      return (
        <span className={`veil-msg-status ${className}`.trim()} title="Sending..." aria-label="Sending">
          <RefreshCwIcon size={size} className="veil-spin" color="var(--veil-text-muted)" />
        </span>
      );
    case 'SENT_TO_RELAY':
      return (
        <span className={`veil-msg-status ${className}`.trim()} title="Sent to Relay" aria-label="Sent to relay">
          <CheckIcon size={size} color="var(--veil-text-secondary)" />
        </span>
      );
    case 'DELIVERED_TO_RECIPIENT':
    case 'PROCESSED':
      return (
        <span
          className={`veil-msg-status ${className}`.trim()}
          title="Delivered & Read"
          aria-label="Delivered and read"
        >
          <CheckCheckIcon size={size} color="var(--veil-accent-secondary)" />
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
