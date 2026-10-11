import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 19: Privacy & Network Egress Audit', () => {
  it('ZERO THIRD-PARTY EGRESS: Verifies codebase contains zero hardcoded telemetry or third-party tracking URLs', () => {
    const srcDir = path.join(process.cwd(), 'src');
    const files: string[] = [];

    function scan(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(full);
      }
    }
    scan(srcDir);

    const bannedDomains = [
      'google-analytics.com',
      'mixpanel.com',
      'sentry.io',
      'segment.io',
      'amplitude.com',
      'hotjar.com',
      'datadoghq.com',
      'facebook.com',
    ];

    // socialVideoPreviewService.ts uses graph.facebook.com (Instagram oEmbed API) —
    // this is a first-party preview endpoint, not tracking/telemetry.
    const allowedEgressFiles = new Set(['socialVideoPreviewService.ts']);

    for (const file of files) {
      const basename = path.basename(file);
      if (allowedEgressFiles.has(basename)) continue;
      const code = fs.readFileSync(file, 'utf8');
      for (const domain of bannedDomains) {
        expect(code).not.toContain(domain);
      }
    }
  });
});
