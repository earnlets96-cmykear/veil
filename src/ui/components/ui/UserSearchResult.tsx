/**
 * Reusable User Search & Discovery Result Card for VEIL.
 *
 * Renders user discovery cards with avatar thumbnail, display name,
 * @username handle, and relationship-aware status badges.
 */

import React from 'react';
import { Avatar } from './Avatar.tsx';
import { Badge } from './Badge.tsx';
import { RelationshipState } from '../../../contacts/relationshipHelper.ts';

export interface UserSearchResultProps {
  displayName: string;
  username: string;
  avatarUrl?: string;
  relationshipState?: RelationshipState;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
  selected?: boolean;
}

export const UserSearchResult: React.FC<UserSearchResultProps> = ({
  displayName,
  username,
  avatarUrl,
  relationshipState = 'NOT_CONNECTED',
  subtitle,
  onClick,
  className = '',
  selected = false,
}) => {
  const cleanUsername = username.startsWith('@') ? username : `@${username}`;

  const renderBadge = () => {
    switch (relationshipState) {
      case 'SELF':
        return <Badge variant="neutral">You</Badge>;
      case 'CONTACT_VERIFIED':
        return <Badge variant="secure">Verified</Badge>;
      case 'CONTACT_UNVERIFIED':
        return <Badge variant="secure">Contact</Badge>;
      case 'PENDING_OUTGOING':
        return <Badge variant="warning">Sent</Badge>;
      case 'PENDING_INCOMING':
        return <Badge variant="warning">Request</Badge>;
      case 'BLOCKED':
        return <Badge variant="danger">Blocked</Badge>;
      default:
        return null;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`veil-conversation-item ${selected ? 'active' : ''} ${className}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 0.75rem',
        minHeight: '44px',
        cursor: 'pointer',
      }}
      aria-label={`User ${displayName} ${cleanUsername}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
        <Avatar name={displayName || username} imageUrl={avatarUrl} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: 'var(--veil-text-sm)',
                color: 'var(--veil-text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </span>
            <span
              style={{
                fontSize: 'var(--veil-text-xs)',
                color: 'var(--veil-accent-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cleanUsername}
            </span>
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 'var(--veil-text-xs)',
                color: 'var(--veil-text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginTop: '0.1rem',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginLeft: '0.5rem', flexShrink: 0 }}>
        {renderBadge()}
      </div>
    </div>
  );
};
