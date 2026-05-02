import type { TicketType } from '../models/types.js';

const INCIDENT_STATUSES = [
  'New',
  'InTriage',
  'InProgress',
  'PendingUser',
  'Pending3rdParty',
  'Resolved',
  'Closed',
] as const;

const SR_STATUSES = [
  'New',
  'AwaitingApproval',
  'Approved',
  'InProgress',
  'Completed',
  'Closed',
] as const;

export function isValidStatusForType(type: TicketType, status: string): boolean {
  if (type === 'Incident') {
    return (INCIDENT_STATUSES as readonly string[]).includes(status);
  }
  return (SR_STATUSES as readonly string[]).includes(status);
}

const incidentTransitions: Record<string, string[]> = {
  New: ['InTriage', 'InProgress', 'Closed'],
  InTriage: ['InProgress', 'PendingUser', 'Pending3rdParty', 'Resolved', 'Closed'],
  InProgress: ['PendingUser', 'Pending3rdParty', 'Resolved', 'Closed'],
  PendingUser: ['InProgress', 'Resolved', 'Closed'],
  Pending3rdParty: ['InProgress', 'Resolved', 'Closed'],
  Resolved: ['Closed', 'InProgress'],
  Closed: [],
};

const srTransitions: Record<string, string[]> = {
  New: ['AwaitingApproval', 'Approved', 'InProgress', 'Completed', 'Closed'],
  AwaitingApproval: ['Approved', 'InProgress', 'Closed'],
  Approved: ['InProgress', 'Completed', 'Closed'],
  InProgress: ['Completed', 'Closed'],
  Completed: ['Closed'],
  Closed: [],
};

export function canTransition(type: TicketType, fromStatus: string, toStatus: string): boolean {
  if (fromStatus === toStatus) return true;
  const terminalReadonly = ['Closed'];
  if (terminalReadonly.includes(fromStatus) && fromStatus !== toStatus) return false;

  if (type === 'Incident') {
    const next = incidentTransitions[fromStatus];
    return next?.includes(toStatus) ?? false;
  }
  const next = srTransitions[fromStatus];
  return next?.includes(toStatus) ?? false;
}
