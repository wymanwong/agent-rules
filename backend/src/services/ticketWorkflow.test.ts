import { describe, it, expect } from 'vitest';
import { canTransition, isValidStatusForType } from './ticketWorkflow.js';

describe('incident workflow', () => {
  it('allows New -> InTriage', () => {
    expect(canTransition('Incident', 'New', 'InTriage')).toBe(true);
  });
  it('blocks Closed -> InProgress', () => {
    expect(canTransition('Incident', 'Closed', 'InProgress')).toBe(false);
  });
  it('validates incident statuses', () => {
    expect(isValidStatusForType('Incident', 'Resolved')).toBe(true);
    expect(isValidStatusForType('Incident', 'Approved')).toBe(false);
  });
});

describe('service request workflow', () => {
  it('allows AwaitingApproval -> Approved', () => {
    expect(canTransition('ServiceRequest', 'AwaitingApproval', 'Approved')).toBe(true);
  });
  it('allows rejection path to Closed', () => {
    expect(canTransition('ServiceRequest', 'AwaitingApproval', 'Closed')).toBe(true);
  });
});
