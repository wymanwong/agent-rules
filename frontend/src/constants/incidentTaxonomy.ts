/**
 * Recommended incident classification for end-user reporting (category → subcategories).
 * Stored as plain strings on tickets.category / tickets.subcategory.
 */
export const INCIDENT_CATEGORY_LABELS = [
  'Hardware',
  'Software',
  'Network',
  'Account & access',
  'Facilities & workspace',
  'Security',
  'Other',
] as const;

export type IncidentCategory = (typeof INCIDENT_CATEGORY_LABELS)[number];

export const INCIDENT_SUBCATEGORIES: Record<IncidentCategory, readonly string[]> = {
  Hardware: ['Laptop / desktop', 'Monitor / display', 'Peripherals', 'Printer / MFP', 'Mobile device', 'Other hardware'],
  Software: ['Application error', 'Operating system', 'Browser', 'Office / productivity', 'Install / license', 'Other software'],
  Network: ['Wi-Fi', 'LAN / wired', 'VPN', 'Internet connectivity', 'DNS / firewall', 'Other network'],
  'Account & access': ['Password / lockout', 'MFA', 'Application access', 'Privileged access', 'Email / calendar', 'Other access'],
  'Facilities & workspace': ['Desk / workspace', 'Meeting room AV', 'Physical access', 'Other facilities'],
  Security: ['Malware / suspicious activity', 'Phishing report', 'Data handling concern', 'Other security'],
  Other: ['General / unclear'],
};

/** Flat list for filters / autocomplete if needed later */
export function allIncidentSubcategories(): string[] {
  const out: string[] = [];
  for (const subs of Object.values(INCIDENT_SUBCATEGORIES)) {
    out.push(...subs);
  }
  return [...new Set(out)].sort();
}
