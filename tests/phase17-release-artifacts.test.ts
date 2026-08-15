import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VEIL Phase 17: Production Release Artifacts & Deployment Verification', () => {
  it('DEPLOYMENT ASSETS: Confirms availability of Dockerfile, Caddyfile, Nginx, and Systemd templates', () => {
    const deploymentDir = path.join(process.cwd(), 'deployment');
    expect(fs.existsSync(deploymentDir)).toBe(true);

    expect(fs.existsSync(path.join(deploymentDir, 'Caddyfile.example'))).toBe(true);
    expect(fs.existsSync(path.join(deploymentDir, 'nginx', 'veil.conf.example'))).toBe(true);
    expect(fs.existsSync(path.join(deploymentDir, 'systemd', 'veil-relay.service.example'))).toBe(true);
    expect(fs.existsSync(path.join(deploymentDir, 'docker', 'Dockerfile'))).toBe(true);
    expect(fs.existsSync(path.join(deploymentDir, 'docker', 'docker-compose.yml'))).toBe(true);
    expect(fs.existsSync(path.join(deploymentDir, '.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(deploymentDir, 'README.md'))).toBe(true);
  });
});
