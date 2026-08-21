/**
 * Accessible Message Timestamp Component for VEIL.
 */

import React from 'react';

export interface MessageTimestampProps {
  timestamp: number | Date;
  className?: string;
}

export const MessageTimestamp: React.FC<MessageTimestampProps> = ({ timestamp, className = '' }) => {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isoString = date.toISOString();

  return (
    <time dateTime={isoString} className={className} style={{ fontSize: '0.68rem', opacity: 0.85 }}>
      {timeString}
    </time>
  );
};
