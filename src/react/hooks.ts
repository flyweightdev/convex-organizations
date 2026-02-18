import { useQuery, useMutation } from "convex/react";
import { useUserOrgContext } from "./provider.js";
import { useMemo, useCallback, useState } from "react";

// ============================================================================
// USER
// ============================================================================

export function useUser() {
  const { api } = useUserOrgContext();
  const profile = useQuery(api.getMyProfile);
  return {
    profile: profile ?? null,
    isLoading: profile === undefined,
  };
}

export function useUpdateProfile() {
  const { api } = useUserOrgContext();
  return useMutation(api.updateMyProfile);
}

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export function useOrganizationList() {
  const { api } = useUserOrgContext();
  const organizations = useQuery(api.listMyOrgs);

  return {
    organizations: organizations ?? [],
    isLoading: organizations === undefined,
  };
}

export function useCreateOrg() {
  const { api } = useUserOrgContext();
  return useMutation(api.createOrg);
}

// ============================================================================
// ACTIVE ORGANIZATION
// ============================================================================

export function useActiveOrganization() {
  const { api } = useUserOrgContext();
  const { profile, isLoading: isProfileLoading } = useUser();
  const setActiveMutation = useMutation(api.setActiveOrg);

  const activeOrgId = profile?.activeOrgId ?? undefined;

  const organization = useQuery(
    api.getOrg,
    activeOrgId ? { orgId: activeOrgId } : "skip",
  );

  const membership = useQuery(
    api.getMyMembership,
    activeOrgId ? { orgId: activeOrgId } : "skip",
  );

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!membership) return false;
      const perms = membership.role.permissions;
      if (perms.includes("*")) return true;
      return perms.includes(permission);
    },
    [membership],
  );

  const setActive = useCallback(
    async (orgId: string | undefined) => {
      await setActiveMutation({ orgId });
    },
    [setActiveMutation],
  );

  return {
    organization: organization ?? null,
    membership: membership ?? null,
    role: membership?.role ?? null,
    hasPermission,
    setActive,
    isLoading:
      isProfileLoading ||
      (!!activeOrgId &&
        (organization === undefined || membership === undefined)),
  };
}

// ============================================================================
// MEMBERS
// ============================================================================

export function useMembers(orgId: string | undefined) {
  const { api } = useUserOrgContext();
  const members = useQuery(api.listMembers, orgId ? { orgId } : "skip");

  return {
    members: members ?? [],
    isLoading: members === undefined,
  };
}

export function useUpdateMemberRole() {
  const { api } = useUserOrgContext();
  return useMutation(api.updateMemberRole);
}

export function useRemoveMember() {
  const { api } = useUserOrgContext();
  return useMutation(api.removeMember);
}

export function useLeaveOrg() {
  const { api } = useUserOrgContext();
  return useMutation(api.leaveOrg);
}

// ============================================================================
// ROLES
// ============================================================================

export function useRoles(orgId: string | undefined) {
  const { api } = useUserOrgContext();
  const roles = useQuery(api.listRoles, orgId ? { orgId } : "skip");

  return {
    roles: roles ?? [],
    isLoading: roles === undefined,
  };
}

export function useCreateRole() {
  const { api } = useUserOrgContext();
  return useMutation(api.createRole);
}

export function useUpdateRole() {
  const { api } = useUserOrgContext();
  return useMutation(api.updateRole);
}

export function useDeleteRole() {
  const { api } = useUserOrgContext();
  return useMutation(api.deleteRole);
}

// ============================================================================
// INVITATIONS
// ============================================================================

export function useInvitations(orgId: string | undefined) {
  const { api } = useUserOrgContext();
  const invitations = useQuery(
    api.listInvitations,
    orgId ? { orgId } : "skip",
  );

  return {
    invitations: invitations ?? [],
    isLoading: invitations === undefined,
  };
}

export function useCreateInvitation() {
  const { api } = useUserOrgContext();
  return useMutation(api.createInvitation);
}

export function useRevokeInvitation() {
  const { api } = useUserOrgContext();
  return useMutation(api.revokeInvitation);
}

export function useAcceptInvitation() {
  const { api } = useUserOrgContext();
  return useMutation(api.acceptInvitation);
}

export function useDeclineInvitation() {
  const { api } = useUserOrgContext();
  return useMutation(api.declineInvitation);
}

// ============================================================================
// DEVICES
// ============================================================================

export function useCurrentSessionId() {
  const { api } = useUserOrgContext();
  const sessionId = useQuery(api.getCurrentSessionId);
  return sessionId ?? null;
}

export function useDevices(currentSessionId?: string) {
  const { api } = useUserOrgContext();
  const devices = useQuery(api.listMyDevices);
  const autoSessionId = useCurrentSessionId();
  const resolvedSessionId = currentSessionId ?? autoSessionId;

  const currentDevice = useMemo(() => {
    if (!resolvedSessionId || !devices) return null;
    return devices.find((d: any) => d.sessionId === resolvedSessionId) ?? null;
  }, [devices, resolvedSessionId]);

  return {
    devices: devices ?? [],
    currentDevice,
    isLoading: devices === undefined,
  };
}

export function useRemoveDevice() {
  const { api } = useUserOrgContext();
  return useMutation(api.removeDevice);
}

export function useRemoveAllOtherDevices() {
  const { api } = useUserOrgContext();
  return useMutation(api.removeAllOtherDevices);
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export function useAuditLogs(
  orgId: string | undefined,
  filters?: {
    action?: string;
    actorUserId?: string;
    resourceType?: string;
    limit?: number;
  },
) {
  const { api } = useUserOrgContext();
  const [limit, setLimit] = useState(filters?.limit ?? 50);

  const logs = useQuery(
    api.listAuditLogs,
    orgId ? { orgId, ...filters, limit } : "skip",
  );

  const loadMore = useCallback(
    (count: number = 50) => {
      setLimit((prev) => prev + count);
    },
    [],
  );

  return {
    logs: logs ?? [],
    isLoading: logs === undefined,
    loadMore,
  };
}
