/**
 * Accessible Message Delivery Status Indicator Component for VEIL.
 */

import React from 'react';

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
}

export const MessageStatus: React.FC<MessageStatusProps> = ({ status, className = '' }) => {
  switch (status) {
    case 'QUEUED':
      return (
        <span className={className} title="Queued locally (Offline)" aria-label="Queued locally">
          ⏳
        </span>
      );
    case 'SENDING':
      return (
        <span className={className} title="Encrypting & Sending" aria-label="Encrypting and sending">
          🔄
        </span>
      );
    case 'SENT_TO_RELAY':
      return (
        <span className={className} title="Delivered to Relay" aria-label="Delivered to relay">
          ✓
        </span>
      );
    case 'DELIVERED_TO_RECIPIENT':
    case 'PROCESSED':
      return (
        <span
          className={className}
          title="Delivered & Decrypted by Peer"
          aria-label="Delivered and decrypted"
          style={{ color: 'var(--veil-success)', fontWeight: 'bold' }}
        >
          ✓✓
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={className}
          title="Failed to deliver"
          aria-label="Failed to deliver"
          style={{ color: 'var(--veil-danger)' }}
        >
          ⚠️
        </span>
      );
    default:
      return (
        <span className={className} aria-hidden="true">
          ✓
        </span>
      );
  }
};
