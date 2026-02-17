import type { FunctionReference } from "convex/server";

export interface UserOrgApi {
  getMyProfile: FunctionReference<"query", "public">;
  updateMyProfile: FunctionReference<"mutation", "public">;
  setActiveOrg: FunctionReference<"mutation", "public">;
  createOrg: FunctionReference<"mutation", "public">;
  getOrg: FunctionReference<"query", "public">;
  getOrgBySlug: FunctionReference<"query", "public">;
  updateOrg: FunctionReference<"mutation", "public">;
  deleteOrg: FunctionReference<"mutation", "public">;
  listMyOrgs: FunctionReference<"query", "public">;
  listRoles: FunctionReference<"query", "public">;
  createRole: FunctionReference<"mutation", "public">;
  updateRole: FunctionReference<"mutation", "public">;
  deleteRole: FunctionReference<"mutation", "public">;
  listMembers: FunctionReference<"query", "public">;
  getMyMembership: FunctionReference<"query", "public">;
  updateMemberRole: FunctionReference<"mutation", "public">;
  removeMember: FunctionReference<"mutation", "public">;
  leaveOrg: FunctionReference<"mutation", "public">;
  createInvitation: FunctionReference<"mutation", "public">;
  listInvitations: FunctionReference<"query", "public">;
  revokeInvitation: FunctionReference<"mutation", "public">;
  getInvitationByToken: FunctionReference<"query", "public">;
  acceptInvitation: FunctionReference<"mutation", "public">;
  declineInvitation: FunctionReference<"mutation", "public">;
  listMyDevices: FunctionReference<"query", "public">;
  removeDevice: FunctionReference<"mutation", "public">;
  removeAllOtherDevices: FunctionReference<"mutation", "public">;
  checkPermission: FunctionReference<"query", "public">;
  listAuditLogs: FunctionReference<"query", "public">;
}

export interface AdminApi {
  listAllUsers: FunctionReference<"query", "public">;
  getUserDetail: FunctionReference<"query", "public">;
  banUser: FunctionReference<"mutation", "public">;
  unbanUser: FunctionReference<"mutation", "public">;
  setAdmin: FunctionReference<"mutation", "public">;
  deleteUser: FunctionReference<"mutation", "public">;
  listAllOrgs: FunctionReference<"query", "public">;
  getOrgDetail: FunctionReference<"query", "public">;
  forceRemoveMember: FunctionReference<"mutation", "public">;
  transferOwnership: FunctionReference<"mutation", "public">;
  startImpersonation: FunctionReference<"mutation", "public">;
  stopImpersonation: FunctionReference<"mutation", "public">;
  getActiveImpersonation: FunctionReference<"query", "public">;
  listImpersonationHistory: FunctionReference<"query", "public">;
  listPlatformAuditLogs: FunctionReference<"query", "public">;
}

export interface UserOrgContextValue {
  api: UserOrgApi;
  adminApi?: AdminApi;
}
