import type { Impact, Priority, Urgency } from '../models/types.js';

/** ITIL-style impact × urgency → priority matrix */
export function computePriority(impact: Impact, urgency: Urgency): Priority {
  const matrix: Record<Impact, Record<Urgency, Priority>> = {
    SingleUser: {
      Low: 'P4',
      Medium: 'P4',
      High: 'P3',
      Critical: 'P3',
    },
    Department: {
      Low: 'P4',
      Medium: 'P3',
      High: 'P2',
      Critical: 'P2',
    },
    Site: {
      Low: 'P3',
      Medium: 'P2',
      High: 'P2',
      Critical: 'P1',
    },
    Organization: {
      Low: 'P3',
      Medium: 'P2',
      High: 'P1',
      Critical: 'P1',
    },
  };
  return matrix[impact][urgency];
}

/** SLA due_at from priority: P1 +4h, P2 +8h, P3 +3d, P4 +5d */
export function computeDueAtIso(now: Date, priority: Priority): string {
  const d = new Date(now.getTime());
  switch (priority) {
    case 'P1':
      d.setHours(d.getHours() + 4);
      break;
    case 'P2':
      d.setHours(d.getHours() + 8);
      break;
    case 'P3':
      d.setDate(d.getDate() + 3);
      break;
    case 'P4':
      d.setDate(d.getDate() + 5);
      break;
    default:
      d.setDate(d.getDate() + 5);
  }
  return d.toISOString();
}

export function formatTicketNumber(id: number): string {
  return `IT-${String(id).padStart(6, '0')}`;
}
