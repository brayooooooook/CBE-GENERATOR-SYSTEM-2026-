import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Connection Status Indicator Truthful Audit & Role-Tailored Verification', () => {
  const componentPath = path.resolve(process.cwd(), 'src/components/ConnectionStatusIndicator.tsx');
  const componentContent = fs.readFileSync(componentPath, 'utf-8');

  it('1. Verifies false auto-save statement is completely eliminated from the codebase', () => {
    expect(componentContent).not.toContain('All changes save automatically');
    expect(componentContent).not.toContain('save automatically');
    expect(componentContent).not.toContain('Your changes will save once reconnected');
  });

  it('2. Verifies unverified cloud storage claim is completely eliminated', () => {
    expect(componentContent).not.toContain('cloud storage');
  });

  it('3. Verifies Administrator role retains technical diagnostic copy and database breakdown', () => {
    expect(componentContent).toContain('System Connected');
    expect(componentContent).toContain('Connected to the school database.');
    expect(componentContent).toContain('Connecting to System');
    expect(componentContent).toContain('Verifying connection and syncing records with the school database.');
    expect(componentContent).toContain('Offline Mode');
    expect(componentContent).toContain('School Database');
    expect(componentContent).toContain('isAdmin');
  });

  it('4. Verifies Teacher roles (class_teacher & subject_teacher) receive calm, reassuring copy without database jargon', () => {
    expect(componentContent).toContain("Everything is ready. Your work and assessments are in sync.");
    expect(componentContent).toContain("Please wait while we check the school system.");
    expect(componentContent).toContain("You're Offline");
    expect(componentContent).toContain("Please check your internet connection and try again.");
  });

  it('5. Verifies Learner role receives simple, student-friendly copy', () => {
    expect(componentContent).toContain("You're ready to continue.");
    expect(componentContent).toContain("Please wait while we connect you to the school portal.");
    expect(componentContent).toContain("No Internet Connection");
  });

  it('6. Verifies administrator diagnostics button remains strictly restricted to admins only', () => {
    expect(componentContent).toContain('isAdmin && onNavigateToDiagnostics');
    expect(componentContent).toContain('Diagnostics');
    expect(componentContent).toContain('onNavigateToDiagnostics');
  });

  it('7. Verifies Check Connection retry action is present and accessible to all users', () => {
    expect(componentContent).toContain('Check Connection');
    expect(componentContent).toContain('onRetryConnection');
    expect(componentContent).toContain('handleRetry');
  });
});
