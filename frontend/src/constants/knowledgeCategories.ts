/**
 * Knowledge article categories — stable labels for filtering and authoring.
 * Use Title Case; match seeded/demo articles where possible (Network, Hardware).
 */
export const KNOWLEDGE_CATEGORY_LABELS = [
  'Getting started',
  'Account & access',
  'Hardware',
  'Software',
  'Network',
  'Email & collaboration',
  'Security',
  'Policies & procedures',
  'Service catalog',
  'General',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORY_LABELS)[number];
