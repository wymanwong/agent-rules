export type UserRole = 'EndUser' | 'IT' | 'Admin';

export type TicketType = 'Incident' | 'ServiceRequest';

export type Impact = 'SingleUser' | 'Department' | 'Site' | 'Organization';

export type Urgency = 'Low' | 'Medium' | 'High' | 'Critical';

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export type IncidentStatus =
  | 'New'
  | 'InTriage'
  | 'InProgress'
  | 'PendingUser'
  | 'Pending3rdParty'
  | 'Resolved'
  | 'Closed';

export type ServiceRequestStatus =
  | 'New'
  | 'AwaitingApproval'
  | 'Approved'
  | 'InProgress'
  | 'Completed'
  | 'Closed';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface JwtPayload {
  userId: number;
  role: UserRole;
  teamId: number | null;
}
