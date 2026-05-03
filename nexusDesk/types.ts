
export type Priority = 'Low' | 'Medium' | 'High' | 'Emergency';
export type TicketStatus = 'Open' | 'Assigned' | 'In Progress' | 'Pending' | 'Resolved' | 'Closed' | 'Failed';
export type RecordType = 'Incident';
export type UserRole = 'Client' | 'Agent' | 'Admin';
export type TicketChannel = 'Web' | 'Email' | 'Phone';
export type DatabaseEngine = 'MSSQL' | 'MongoDB';

export interface SystemSettings {
  ticketPrefix: string;
  supportEmail: string;
  autoResponseEnabled: boolean;
  emailFetchInterval: number; // in minutes
  // SSO & Security
  ssoEnabled: boolean;
  localLoginEnabled: boolean;
  microsoftClientId: string;
  microsoftTenantId: string;
  requireMfa: boolean;
  // Database
  databaseEngine: DatabaseEngine;
  dbConnectionString: string;
  dbName: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface TicketComment {
  id: string;
  author: string;
  authorRole: 'Agent' | 'User';
  text: string;
  timestamp: string;
  isInternal: boolean;
  attachments?: Attachment[];
}

export interface Ticket {
  id: string;
  type: RecordType;
  channel: TicketChannel;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  category: string;
  requester: {
    name: string;
    email: string;
    department: string;
    id: string; // Linked to a user
  };
  assignedTo?: string; // Agent ID
  assignedTeam?: string;
  createdAt: string;
  updatedAt: string;
  history: TicketComment[];
  slaDeadline: string;
  attachments?: Attachment[];
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  department: string;
  status: 'Online' | 'Away' | 'Offline';
  activeTickets: number;
  specialties: string[];
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  author: string;
  updatedAt: string;
  views: number;
  tags: string[];
}
