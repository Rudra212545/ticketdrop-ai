export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'BANNED';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  organizerApprovalStatus: ApprovalStatus | null;
  orgName: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresInMs: number;
  user: UserSummary;
}

export interface OrganizerSummary {
  profileId: string;
  userId: string;
  email: string;
  fullName: string;
  orgName: string;
  registrationNo: string | null;
  approvalStatus: ApprovalStatus;
  platformFeeBps: number;
  createdAt: string;
}

export interface UserModerationResponse {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export interface AuditLogResponse {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  newState: string | null;
  ipAddress: string | null;
  createdAt: string;
}

