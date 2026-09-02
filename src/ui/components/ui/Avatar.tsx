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
  src?: string; // Phase 56: Compatibility alias for imageUrl
  size?: AvatarSize | number;
  isSquare?: boolean;
  isGroup?: boolean;
  status?: 'online' | 'offline';
  className?: string;
  'aria-label'?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = 'User',
  imageUrl,
  src,
  size = 'md',
  isSquare = false,
  isGroup = false,
  status,
  className = '',
  'aria-label': ariaLabel,
}) => {
  const effectiveImageUrl = imageUrl || src;
  const isNumericSize = typeof size === 'number';
  const sizeClass = isNumericSize ? '' : `veil-avatar-${size}`;
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
    if (isNumericSize) return Math.max(14, Math.round((size as number) * 0.3));
    switch (size) {
      case 'xs': return 12;
      case 'sm': return 14;
      case 'lg': return 24;
      case 'xl': return 32;
      case 'md':
      default: return 18;
    }
  };

  const numericStyle = isNumericSize
    ? {
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        fontSize: `${Math.max(12, Math.round((size as number) * 0.38))}px`,
      }
    : {};

  return (
    <div
      className={`veil-avatar ${sizeClass} ${shapeClass} ${className}`.trim()}
      style={{
        ...numericStyle,
        background: effectiveImageUrl ? 'none' : getGradient(name, isGroup),
        backgroundImage: effectiveImageUrl ? `url(${effectiveImageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      role="img"
      aria-label={ariaLabel || (isGroup ? 'Group Avatar' : 'Peer Avatar')}
    >
      {!effectiveImageUrl && (
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
