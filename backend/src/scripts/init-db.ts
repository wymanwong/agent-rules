/**
 * Initialize PostgreSQL schema and seed demo data when users table is empty.
 * Use --force to drop application tables and re-seed (destructive).
 */
import { env } from '../config/env.js';
import { getPool, ensurePgSchema, query, closePool } from '../db/pg.js';
import * as teamRepo from '../repositories/teamRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import * as catalogRepo from '../repositories/catalogRepository.js';
import * as kbRepo from '../repositories/knowledgeRepository.js';
import { hashPassword } from '../services/authService.js';
import { extraFieldsToFormSchemaJson, normalizeExtraFields } from '../services/catalogFormFields.js';

async function dropAppTables(): Promise<void> {
  await query(`
    DROP TABLE IF EXISTS ticket_attachments CASCADE;
    DROP TABLE IF EXISTS comments CASCADE;
    DROP TABLE IF EXISTS assignment_history CASCADE;
    DROP TABLE IF EXISTS approvals CASCADE;
    DROP TABLE IF EXISTS tickets CASCADE;
    DROP TABLE IF EXISTS knowledge_articles CASCADE;
    DROP TABLE IF EXISTS service_catalog_items CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS teams CASCADE;
  `);
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  getPool();

  if (force) {
    await dropAppTables();
  }

  await ensurePgSchema();

  const countRow = await query<{ c: string }>('SELECT COUNT(*)::text as c FROM users');
  const existingUsers = Number(countRow.rows[0]?.c ?? 0);
  if (existingUsers > 0 && !force) {
    console.info('Database already seeded; use --force to reset.');
    await closePool();
    process.exit(0);
    return;
  }

  const now = new Date().toISOString();

  const helpdeskId = await teamRepo.insertTeam(null, {
    name: 'Helpdesk',
    description: 'Tier 1 support',
    created_at: now,
    updated_at: now,
  });
  const netId = await teamRepo.insertTeam(null, {
    name: 'Network',
    description: 'Network operations',
    created_at: now,
    updated_at: now,
  });
  const appsId = await teamRepo.insertTeam(null, {
    name: 'Applications',
    description: 'Business applications',
    created_at: now,
    updated_at: now,
  });

  const pwd = await hashPassword('password123');

  await userRepo.insertUser(null, {
    name: 'System Admin',
    email: 'admin@example.com',
    department: 'IT',
    role: 'Admin',
    password_hash: pwd,
    team_id: helpdeskId,
    created_at: now,
    updated_at: now,
  });

  await userRepo.insertUser(null, {
    name: 'Helpdesk Analyst',
    email: 'it.helpdesk@example.com',
    department: 'IT',
    role: 'IT',
    password_hash: pwd,
    team_id: helpdeskId,
    created_at: now,
    updated_at: now,
  });

  await userRepo.insertUser(null, {
    name: 'Network Engineer',
    email: 'it.network@example.com',
    department: 'IT',
    role: 'IT',
    password_hash: pwd,
    team_id: netId,
    created_at: now,
    updated_at: now,
  });

  await userRepo.insertUser(null, {
    name: 'Apps Analyst',
    email: 'it.apps@example.com',
    department: 'IT',
    role: 'IT',
    password_hash: pwd,
    team_id: appsId,
    created_at: now,
    updated_at: now,
  });

  await userRepo.insertUser(null, {
    name: 'Jane EndUser',
    email: 'user@example.com',
    department: 'Finance',
    role: 'EndUser',
    password_hash: pwd,
    team_id: null,
    created_at: now,
    updated_at: now,
  });

  const seedExtra1 = normalizeExtraFields([
    { key: 'softwareName', label: 'Software name', kind: 'short_text' },
    { key: 'businessReason', label: 'Business reason', kind: 'paragraph' },
  ]);
  await catalogRepo.insertItem(null, {
    name: 'Request software installation',
    description: 'Standard request to install approved corporate software.',
    type: 'ServiceRequest',
    default_category: 'Software',
    default_subcategory: 'Installation',
    default_impact: 'SingleUser',
    default_urgency: 'Medium',
    default_priority: null,
    requires_manager_approval: 0,
    form_schema_json: extraFieldsToFormSchemaJson(seedExtra1),
    extra_form_fields_json: JSON.stringify(seedExtra1),
    is_published: 1,
    created_at: now,
    updated_at: now,
  });

  const seedExtra2 = normalizeExtraFields([{ key: 'system', label: 'Target system', kind: 'short_text' }]);
  await catalogRepo.insertItem(null, {
    name: 'Request elevated access',
    description: 'Requires manager approval before fulfillment.',
    type: 'ServiceRequest',
    default_category: 'Access',
    default_subcategory: 'Privileged',
    default_impact: 'Department',
    default_urgency: 'High',
    default_priority: null,
    requires_manager_approval: 1,
    form_schema_json: extraFieldsToFormSchemaJson(seedExtra2),
    extra_form_fields_json: JSON.stringify(seedExtra2),
    is_published: 1,
    created_at: now,
    updated_at: now,
  });

  await kbRepo.insertArticle(null, {
    title: 'Reset your VPN client',
    body: '<p>Close the VPN client, restart it, and reconnect using SSO. If issues persist, open an incident.</p>',
    body_format: 'html',
    category: 'Network',
    tags: 'vpn,network',
    is_published: 1,
    created_at: now,
    updated_at: now,
  });

  await kbRepo.insertArticle(null, {
    title: 'How to request a new laptop',
    body:
      '<p>Use the service catalog item <strong>Request hardware refresh</strong> or contact the Helpdesk.</p><h2>Steps</h2><ol><li>Open <strong>Service catalog</strong>.</li><li>Choose the hardware item.</li><li>Submit the form with your asset tag.</li></ol>',
    body_format: 'html',
    category: 'Hardware',
    tags: 'laptop,hardware',
    is_published: 1,
    created_at: now,
    updated_at: now,
  });

  await kbRepo.insertArticle(null, {
    title: 'Welcome to the IT portal',
    body:
      '<p>Browse <strong>Knowledge</strong> for fixes, open <strong>incidents</strong> when something breaks, and use the <strong>catalog</strong> for standard requests.</p><blockquote><p>Tip: Use <strong>Share</strong> on any article to email a link or open Microsoft Teams.</p></blockquote>',
    body_format: 'html',
    category: 'Getting started',
    tags: 'portal,introduction',
    is_published: 1,
    created_at: now,
    updated_at: now,
  });

  console.info('PostgreSQL seeded:', env.databaseUrl.replace(/:[^:@]+@/, ':****@'));
  console.info('Demo logins (password: password123):');
  console.info('  admin@example.com (Admin)');
  console.info('  it.helpdesk@example.com (IT / Helpdesk)');
  console.info('  it.network@example.com (IT / Network)');
  console.info('  it.apps@example.com (IT / Applications)');
  console.info('  user@example.com (EndUser)');

  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
