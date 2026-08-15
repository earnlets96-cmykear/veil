import { describe, it, expect, beforeEach } from 'vitest';
import { LocalSearchEngine } from '../src/search/searchEngine.ts';

describe('VEIL Phase 15: Privacy-Aware Local Search Tests', () => {
  let searchEngine: LocalSearchEngine;

  beforeEach(() => {
    searchEngine = new LocalSearchEngine();
  });

  it('IN-MEMORY SEARCH: Finds contacts, groups, and message snippets in active Space', () => {
    const contacts = [
      {
        identityId: 'id_alice_search',
        name: 'Alice Smith',
        fingerprint: 'ALICE-FP',
        signingPublicKey: 'pk1',
        keyAgreementPublicKey: 'pk2',
        status: 'ACCEPTED' as const,
        verificationStatus: 'VERIFIED' as const,
        addedAt: Date.now(),
      },
    ];

    const convs = [
      {
        id: 'grp_security_team',
        type: 'group' as const,
        name: 'Security Team',
        avatarSeed: 'sec',
        unreadCount: 0,
      },
    ];

    const messages = {
      grp_security_team: [
        {
          id: 'm1',
          conversationId: 'grp_security_team',
          senderId: 'alice',
          text: 'The deployment audit passed successfully',
          isOutgoing: false,
          timestamp: Date.now(),
          status: 'DELIVERED_TO_RECIPIENT' as const,
        },
      ],
    };

    searchEngine.updateIndex(contacts, convs, messages);

    // Search contact
    const r1 = searchEngine.search('Alice');
    expect(r1).toHaveLength(1);
    expect(r1[0].title).toBe('Alice Smith');

    // Search group
    const r2 = searchEngine.search('Security');
    expect(r2).toHaveLength(1);
    expect(r2[0].title).toBe('Security Team');

    // Search message body
    const r3 = searchEngine.search('deployment');
    expect(r3).toHaveLength(1);
    expect(r3[0].matchSnippet).toContain('deployment audit passed');
  });

  it('MEMORY PURGE ON LOCK: Clears all search indexes on lock/panic', () => {
    searchEngine.updateIndex(
      [{ identityId: 'id_1', name: 'Secret Contact', fingerprint: 'F1', signingPublicKey: 'k1', keyAgreementPublicKey: 'k2', status: 'ACCEPTED', verificationStatus: 'UNVERIFIED', addedAt: Date.now() }],
      [],
      {}
    );
    expect(searchEngine.search('Secret')).toHaveLength(1);

    searchEngine.clear();
    expect(searchEngine.search('Secret')).toHaveLength(0);
  });
});
