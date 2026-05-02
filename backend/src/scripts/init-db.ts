/**
 * Initialize SQLite schema (via getDb) and seed demo data when empty.
 */
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env.js';
import { getDb, resetDbSingleton } from '../db/index.js';
import * as teamRepo from '../repositories/teamRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import * as catalogRepo from '../repositories/catalogRepository.js';
import * as kbRepo from '../repositories/knowledgeRepository.js';
import { hashPassword } from '../services/authService.js';
import { extraFieldsToFormSchemaJson, normalizeExtraFields } from '../services/catalogFormFields.js';

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const resolved = path.resolve(process.cwd(), env.dbPath);
  if (force && fs.existsSync(resolved)) {
    fs.unlinkSync(resolved);
    resetDbSingleton();
  }

  const db = getDb();
  const existingUsers = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (existingUsers.c > 0 && !force) {
    console.info('Database already seeded; use --force to reset.');
    process.exit(0);
    return;
  }

  const now = new Date().toISOString();

  const helpdeskId = teamRepo.insertTeam(db, {
    name: 'Helpdesk',
    description: 'Tier 1 support',
    created_at: now,
    updated_at: now,
  });
  const netId = teamRepo.insertTeam(db, {
    name: 'Network',
    description: 'Network operations',
    created_at: now,
    updated_at: now,
  });
  const appsId = teamRepo.insertTeam(db, {
    name: 'Applications',
    description: 'Business applications',
    created_at: now,
    updated_at: now,
  });

  const pwd = await hashPassword('password123');

  userRepo.insertUser(db, {
    name: 'System Admin',
    email: 'admin@example.com',
    department: 'IT',
    role: 'Admin',
    password_hash: pwd,
    team_id: helpdeskId,
    created_at: now,
    updated_at: now,
  });

  userRepo.insertUser(db, {
    name: 'Helpdesk Analyst',
    email: 'it.helpdesk@example.com',
    department: 'IT',
    role: 'IT',
    password_hash: pwd,
    team_id: helpdeskId,
    created_at: now,
    updated_at: now,
  });

  userRepo.insertUser(db, {
    name: 'Network Engineer',
    email: 'it.network@example.com',
    department: 'IT',
    role: 'IT',
    password_hash: pwd,
    team_id: netId,
    created_at: now,
    updated_at: now,
  });

  userRepo.insertUser(db, {
    name: 'Apps Analyst',
    email: 'it.apps@example.com',
    department: 'IT',
    role: 'IT',
    password_hash: pwd,
    team_id: appsId,
    created_at: now,
    updated_at: now,
  });

  userRepo.insertUser(db, {
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
  catalogRepo.insertItem(db, {
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
  catalogRepo.insertItem(db, {
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

  kbRepo.insertArticle(db, {
    title: 'Reset your VPN client',
    body: 'Close the VPN client, restart it, and reconnect using SSO. If issues persist, open an incident.',
    category: 'Network',
    tags: 'vpn,network',
    is_published: 1,
    created_at: now,
    updated_at: now,
  });

  kbRepo.insertArticle(db, {
    title: 'How to request a new laptop',
    body: 'Use the service catalog item Request hardware refresh or contact the Helpdesk.',
    category: 'Hardware',
    tags: 'laptop,hardware',
    is_published: 1,
    created_at: now,
    updated_at: now,
  });

  console.info('Database initialized at', resolved);
  console.info('Demo logins (password: password123):');
  console.info('  admin@example.com (Admin)');
  console.info('  it.helpdesk@example.com (IT / Helpdesk)');
  console.info('  it.network@example.com (IT / Network)');
  console.info('  it.apps@example.com (IT / Applications)');
  console.info('  user@example.com (EndUser)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
