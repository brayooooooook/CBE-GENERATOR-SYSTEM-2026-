import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Connection Status Indicator Truthful Audit & Copy Verification', () => {
  const componentPath = path.resolve(process.cwd(), 'src/components/ConnectionStatusIndicator.tsx');
  const componentContent = fs.readFileSync(componentPath, 'utf-8');

  it('verifies false auto-save statement is completely eliminated from the codebase', () => {
    expect(componentContent).not.toContain('All changes save automatically');
    expect(componentContent).not.toContain('save automatically');
  });

  it('verifies unverified cloud storage claim is completely eliminated', () => {
    expect(componentContent).not.toContain('cloud storage');
  });

  it('verifies engineering cloud jargon "Database Cloud Core" is replaced with human-friendly "School Database"', () => {
    expect(componentContent).not.toContain('Database Cloud Core');
    expect(componentContent).toContain('School Database');
  });

  it('verifies accurate, calm, teacher-friendly copy is used for all connection states', () => {
    expect(componentContent).toContain('System Connected');
    expect(componentContent).toContain('Connected to the school database.');
    expect(componentContent).toContain('Offline Mode');
    expect(componentContent).toContain('Connection Interrupted');
    expect(componentContent).toContain('Connecting to System');
    expect(componentContent).toContain('Sign-in Required');
    expect(componentContent).toContain('System Status');
  });

  it('verifies administrator diagnostics button remains conditionally available to admins only', () => {
    expect(componentContent).toContain("currentUser?.role === 'admin'");
    expect(componentContent).toContain('Diagnostics');
    expect(componentContent).toContain('onNavigateToDiagnostics');
  });
});
