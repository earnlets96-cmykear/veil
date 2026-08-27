/**
 * Reusable Avatar Component for VEIL Design System.
 *
 * Supports deterministic initials, custom gradients, size scales,
 * space avatars, and privacy-preserving presence indicators with SVG group icon.
 */

import React from 'react';
import { UsersIcon } from '../icons/index.ts';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name?: string;
  imageUrl?: string;
  size?: AvatarSize;
  isSquare?: boolean;
  isGroup?: boolean;
  status?: 'online' | 'offline';
  className?: string;
  'aria-label'?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = 'User',
  imageUrl,
  size = 'md',
  isSquare = false,
  isGroup = false,
  status,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const sizeClass = `veil-avatar-${size}`;
  const shapeClass = isSquare || isGroup ? 'veil-avatar-square' : '';

  const getInitials = (str: string) => {
    if (!str) return '?';
    const clean = str.replace(/^@/, '').trim();
    return clean.charAt(0).toUpperCase();
  };

  const getGradient = (seed: string, group: boolean) => {
    if (group) return 'var(--veil-gradient-group)';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c1 = Math.abs(hash % 360);
    const c2 = (c1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${c1}, 70%, 55%), hsl(${c2}, 70%, 45%))`;
  };

  const getGroupIconSize = () => {
    switch (size) {
      case 'xs': return 12;
      case 'sm': return 14;
      case 'lg': return 24;
      case 'xl': return 32;
      case 'md':
      default: return 18;
    }
  };

  return (
    <div
      className={`veil-avatar ${sizeClass} ${shapeClass} ${className}`.trim()}
      style={{
        background: imageUrl ? 'none' : getGradient(name, isGroup),
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      role="img"
      aria-label={ariaLabel || (isGroup ? 'Group Avatar' : 'Peer Avatar')}
    >
      {!imageUrl && (
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isGroup ? <UsersIcon size={getGroupIconSize()} color="#ffffff" /> : getInitials(name)}
        </span>
      )}

      {status && (
        <span
          className={`veil-avatar-status veil-avatar-status-${status}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
