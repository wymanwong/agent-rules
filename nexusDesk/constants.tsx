
import React from 'react';
import { Ticket, Agent, Priority, TicketStatus, KnowledgeArticle, UserSession, SystemSettings } from './types';
import { Globe, Mail, Phone } from 'lucide-react';

export const DEFAULT_SETTINGS: SystemSettings = {
  ticketPrefix: 'INC',
  supportEmail: 'support@nexusdesk.com',
  autoResponseEnabled: true,
  emailFetchInterval: 5,
  ssoEnabled: true,
  localLoginEnabled: true,
  microsoftClientId: '00000000-0000-0000-0000-000000000000',
  microsoftTenantId: 'common',
  requireMfa: false,
  databaseEngine: 'MSSQL',
  dbConnectionString: 'nexus-prod-db.windows.net',
  dbName: 'NexusDesk_Prod'
};

export const CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Account/Access',
  'Security',
  'Infrastructure',
  'Database',
  'Cloud Services'
];

export const PRIORITY_COLORS: Record<Priority, string> = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Emergency: 'bg-red-100 text-red-700'
};

export const STATUS_COLORS: Record<string, string> = {
  Open: 'border-blue-500 text-blue-600 bg-blue-50',
  Assigned: 'border-purple-500 text-purple-600 bg-purple-50',
  'In Progress': 'border-indigo-500 text-indigo-600 bg-indigo-50',
  Pending: 'border-yellow-500 text-yellow-600 bg-yellow-50',
  Resolved: 'border-green-500 text-green-600 bg-green-50',
  Closed: 'border-slate-500 text-slate-600 bg-slate-50',
  Failed: 'border-red-500 text-red-600 bg-red-50'
};

export const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  Web: <Globe size={12} />,
  Email: <Mail size={12} />,
  Phone: <Phone size={12} />
};

export const TYPE_ICONS: Record<string, string> = {
  Incident: 'bg-blue-100 text-blue-600'
};

export const MOCK_AGENTS: Agent[] = [
  { id: 'agt-1', name: 'John Agent', email: 'john@nexus.desk', department: 'Level 1 Support', status: 'Online', activeTickets: 3, specialties: ['Hardware', 'Software'] },
  { id: 'agt-2', name: 'Sarah Tech', email: 'sarah@nexus.desk', department: 'Network Ops', status: 'Online', activeTickets: 5, specialties: ['Network', 'Security'] },
  { id: 'agt-3', name: 'Mike Sys', email: 'mike@nexus.desk', department: 'SysAdmin', status: 'Away', activeTickets: 2, specialties: ['Infrastructure', 'Cloud'] },
];

export const MOCK_USERS: UserSession[] = [
  { id: 'user-1', name: 'Alice Smith', email: 'alice@company.com', role: 'Client' },
  { id: 'agt-1', name: 'John Agent', email: 'john@nexus.desk', role: 'Agent' },
  { id: 'admin-1', name: 'Super Admin', email: 'admin@nexus.desk', role: 'Admin' },
];

export const MOCK_KNOWLEDGE: KnowledgeArticle[] = [
  {
    id: 'KB-101',
    title: 'How to Reset Your VPN Password',
    category: 'Network',
    content: '1. Navigate to the self-service portal...\n2. Click on "Identity Management"...\n3. Select "Reset VPN Credential"...',
    author: 'Sarah Tech',
    updatedAt: '2023-12-01',
    views: 1240,
    tags: ['VPN', 'Password', 'Account']
  },
  {
    id: 'KB-200',
    title: 'Configuring MongoDB Atlas Integration',
    category: 'Infrastructure',
    content: 'To connect NexusDesk to MongoDB Atlas:\n\n1. Log in to cloud.mongodb.com\n2. Navigate to "Network Access" and add your server IP or 0.0.0.0/0 for testing.\n3. Go to "Database Access" and create a user with "Read and Write to any database" permissions.\n4. Click "Connect" on your cluster, select "Drivers", and copy the SRV connection string.\n5. Paste that string into the Admin Center > Database Manager.',
    author: 'Super Admin',
    updatedAt: '2024-03-20',
    views: 15,
    tags: ['Database', 'MongoDB', 'Cloud', 'Admin']
  },
  {
    id: 'KB-103',
    title: 'Common Troubleshooting for Dell XPS Laptops',
    category: 'Hardware',
    content: 'If your screen is flickering, try updating the Intel Graphics Driver to version 31.0.101.5081 or later.',
    author: 'John Agent',
    updatedAt: '2024-02-10',
    views: 450,
    tags: ['Dell', 'Display', 'Drivers']
  }
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'INC-1024',
    type: 'Incident',
    channel: 'Web',
    subject: 'Laptop screen flickering randomly',
    description: 'The user reports that their Dell XPS 15 screen starts flickering when connected to an external monitor.',
    status: 'Open',
    priority: 'Medium',
    category: 'Hardware',
    requester: { id: 'user-1', name: 'Alice Smith', email: 'alice@company.com', department: 'Finance' },
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    history: [],
    slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
    attachments: []
  },
  {
    id: 'INC-1025',
    type: 'Incident',
    channel: 'Email',
    subject: 'Recurring MFA timeouts across Sales department',
    description: 'Multiple incidents indicate a pattern of latency with the Duo authentication proxy.',
    status: 'In Progress',
    priority: 'High',
    category: 'Network',
    assignedTo: 'agt-1',
    requester: { id: 'user-1', name: 'Alice Smith', email: 'alice@company.com', department: 'Finance' },
    createdAt: new Date(Date.now() - 1000 * 60 * 5000).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    history: [],
    slaDeadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    attachments: []
  }
];
