/**
 * Accessible Message Delivery Status Indicator Component for VEIL.
 *
 * Status Semantics:
 * - QUEUED: Stored locally, awaiting network (clock icon)
 * - SENDING: Transmission in progress (Telegram-style animated circular SVG stroke)
 * - UPLOADING: Media upload in progress (Telegram-style circular spinner or progress ring)
 * - SENT_TO_RELAY: Delivered to relay server — single gray check
 * - DELIVERED_TO_RECIPIENT: Recipient device received — double gray checks
 * - READ: Recipient opened conversation — double accent-colored checks
 * - FAILED: Delivery failed (alert icon)
 */

import React from 'react';
import { ClockIcon, CheckIcon, CheckCheckIcon, AlertCircleIcon } from '../icons/index.ts';

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

export function normalizeDeliveryStatus(raw: string | undefined | null): DeliveryStatus {
  if (!raw) return 'QUEUED';
  const u = raw.toUpperCase();
  if (u === 'READ' || u === 'SEEN') return 'READ';
  if (u === 'DELIVERED_TO_RECIPIENT' || u === 'DELIVERED' || u === 'RECEIVED' || u === 'PROCESSED') return 'DELIVERED_TO_RECIPIENT';
  if (u === 'SENT_TO_RELAY' || u === 'SENT' || u === 'ACKNOWLEDGED') return 'SENT_TO_RELAY';
  if (u === 'SENDING') return 'SENDING';
  if (u === 'UPLOADING') return 'UPLOADING';
  if (u === 'FAILED') return 'FAILED';
  return 'QUEUED';
}

export interface MessageStatusProps {
  status: DeliveryStatus;
  className?: string;
  size?: number;
  uploadProgress?: number;
}

export const MessageStatus: React.FC<MessageStatusProps> = ({
  status,
  className = '',
  size = 15,
  uploadProgress,
}) => {
  const canonicalStatus = normalizeDeliveryStatus(status);
  switch (canonicalStatus) {
    case 'QUEUED':
      return (
        <span className={`veil-msg-status ${className}`.trim()} title="Queued locally (Offline)" aria-label="Queued locally">
          <ClockIcon size={size} color="var(--veil-text-muted)" />
        </span>
      );
    case 'SENDING':
      return (
        <span className={`veil-msg-status ${className}`.trim()} title="Sending..." aria-label="Sending">
          <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            className="veil-msg-status-spinner"
            style={{ display: 'inline-block', verticalAlign: 'middle' }}
          >
            <circle
              cx="8"
              cy="8"
              r="5.5"
              stroke="var(--veil-text-muted)"
              strokeWidth="1.75"
              strokeDasharray="26"
              strokeDashoffset="13"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </span>
      );
    case 'UPLOADING':
      if (typeof uploadProgress === 'number' && uploadProgress >= 0 && uploadProgress <= 100) {
        const radius = 5.5;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - uploadProgress / 100);
        return (
          <span className={`veil-msg-status ${className}`.trim()} title={`Uploading ${Math.round(uploadProgress)}%`} aria-label={`Uploading ${Math.round(uploadProgress)}%`}>
            <svg
              width={size}
              height={size}
              viewBox="0 0 16 16"
              fill="none"
              style={{ display: 'inline-block', verticalAlign: 'middle', transform: 'rotate(-90deg)' }}
            >
              <circle
                cx="8"
                cy="8"
                r={radius}
                stroke="var(--veil-bg-surface-elevated, rgba(255,255,255,0.2))"
                strokeWidth="1.75"
                fill="none"
              />
              <circle
                cx="8"
                cy="8"
                r={radius}
                stroke="var(--veil-accent-primary, #6366f1)"
                strokeWidth="1.75"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </span>
        );
      }
      return (
        <span className={`veil-msg-status ${className}`.trim()} title="Uploading..." aria-label="Uploading">
          <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            className="veil-msg-status-spinner"
            style={{ display: 'inline-block', verticalAlign: 'middle' }}
          >
            <circle
              cx="8"
              cy="8"
              r="5.5"
              stroke="var(--veil-text-muted)"
              strokeWidth="1.75"
              strokeDasharray="26"
              strokeDashoffset="13"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
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
