/**
 * Reusable User Search & Discovery Result Card for VEIL.
 *
 * Renders user discovery cards with avatar thumbnail, display name,
 * @username handle, relationship-aware status badges, and action buttons.
 */

import React from 'react';
import { Avatar } from './Avatar.tsx';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { RelationshipState } from '../../../contacts/relationshipHelper.ts';
import { DirectorySearchResult } from '../../../server/types.ts';
import { CheckIcon, SendIcon, UserIcon, UserPlusIcon } from '../icons/index.ts';

export interface UserSearchResultProps {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  relationshipState?: RelationshipState;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
  selected?: boolean;

  // Alternate composite props
  result?: DirectorySearchResult;
  relationship?: RelationshipState;
  onOpenProfile?: (result: DirectorySearchResult) => void;
  onSendRequest?: (result: DirectorySearchResult) => Promise<void> | void;
  onMessageUser?: (peerId: string) => void;
}

export const UserSearchResult: React.FC<UserSearchResultProps> = (props) => {
  const {
    result,
    relationship: propRelationship,
    onOpenProfile,
    onSendRequest,
    onMessageUser,
    selected = false,
    className = '',
  } = props;

  const rawUsername = result?.username || props.username || '';
  const rawDisplayName = result?.displayName || props.displayName || rawUsername;
  const avatarUrl = result?.avatar || props.avatarUrl;
  const relationshipState = propRelationship || props.relationshipState || 'NOT_CONNECTED';
  const subtitle = props.subtitle || (result?.bio ? result.bio : undefined);

  const cleanUsername = rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`;

  const handleCardClick = () => {
    if (result && onOpenProfile) {
      onOpenProfile(result);
    } else if (props.onClick) {
      props.onClick();
    }
  };

  const renderActionOrBadge = () => {
    switch (relationshipState) {
      case 'SELF':
        return <Badge variant="neutral">You</Badge>;
      case 'CONTACT_VERIFIED':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Badge variant="secure">Verified</Badge>
            {result && onMessageUser && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMessageUser(result.identityId);
                }}
              >
                <SendIcon size={14} />
                <span>Chat</span>
              </Button>
            )}
          </div>
        );
      case 'CONTACT_UNVERIFIED':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Badge variant="secure">Contact</Badge>
            {result && onMessageUser && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMessageUser(result.identityId);
                }}
              >
                <SendIcon size={14} />
                <span>Chat</span>
              </Button>
            )}
          </div>
        );
      case 'PENDING_OUTGOING':
        return <Badge variant="warning">Request Sent</Badge>;
      case 'PENDING_INCOMING':
        return <Badge variant="warning">Incoming Request</Badge>;
      case 'BLOCKED':
        return <Badge variant="danger">Blocked</Badge>;
      case 'NOT_CONNECTED':
      default:
        if (result && onSendRequest) {
          return (
            <Button
              variant="primary"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation();
                await onSendRequest(result);
              }}
            >
              <UserPlusIcon size={14} />
              <span>Add</span>
            </Button>
          );
        }
        return null;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`veil-conversation-item ${selected ? 'active' : ''} ${className}`}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 0.75rem',
        minHeight: '52px',
        cursor: 'pointer',
      }}
      aria-label={`User ${rawDisplayName} ${cleanUsername}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
        <Avatar name={rawDisplayName || rawUsername} imageUrl={avatarUrl} size="md" />
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
              {rawDisplayName}
            </span>
            <span
              style={{
                fontSize: 'var(--veil-text-xs)',
                color: 'var(--veil-accent-primary)',
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
        {renderActionOrBadge()}
      </div>
    </div>
  );
};
