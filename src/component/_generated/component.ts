/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      acceptInvitation: FunctionReference<
        "mutation",
        "internal",
        { tokenHash: string; userId: string },
        { memberId: string; orgId: string },
        Name
      >;
      banUser: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; reason: string; targetUserId: string },
        null,
        Name
      >;
      checkPermissionQuery: FunctionReference<
        "query",
        "internal",
        { orgId: string; permission: string; userId: string },
        boolean,
        Name
      >;
      createInvitation: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          expiresAt: number;
          orgId: string;
          phone?: string;
          roleId: string;
          tokenHash: string;
          userId: string;
        },
        string,
        Name
      >;
      createOrg: FunctionReference<
        "mutation",
        "internal",
        {
          isPersonal?: boolean;
          metadata?: Record<string, any>;
          name: string;
          slug: string;
          systemRoles: Array<{
            description?: string;
            isSystem: boolean;
            name: string;
            permissions: Array<string>;
            sortOrder: number;
          }>;
          userId: string;
        },
        string,
        Name
      >;
      createRole: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string;
          name: string;
          orgId: string;
          permissions: Array<string>;
          sortOrder: number;
          userId: string;
        },
        string,
        Name
      >;
      declineInvitation: FunctionReference<
        "mutation",
        "internal",
        { tokenHash: string; userId: string },
        null,
        Name
      >;
      deleteOrg: FunctionReference<
        "mutation",
        "internal",
        { orgId: string; userId: string },
        null,
        Name
      >;
      deleteRole: FunctionReference<
        "mutation",
        "internal",
        { orgId: string; roleId: string; userId: string },
        null,
        Name
      >;
      deleteUser: FunctionReference<
        "mutation",
        "internal",
        { actorUserId?: string; userId: string },
        null,
        Name
      >;
      forceRemoveMember: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; orgId: string; targetUserId: string },
        null,
        Name
      >;
      getActiveImpersonation: FunctionReference<
        "query",
        "internal",
        { actorUserId: string },
        {
          _id: string;
          expiresAt: number;
          reason?: string;
          startedAt: number;
          targetUserId: string;
        } | null,
        Name
      >;
      getInvitationByToken: FunctionReference<
        "query",
        "internal",
        { tokenHash: string },
        {
          _id: string;
          email?: string;
          expiresAt: number;
          orgId: string;
          orgName: string;
          orgSlug: string;
          phone?: string;
          roleName: string;
          status: string;
        } | null,
        Name
      >;
      getMembershipQuery: FunctionReference<
        "query",
        "internal",
        { orgId: string; userId: string },
        {
          _id: string;
          joinedAt: number;
          role: {
            _id: string;
            name: string;
            permissions: Array<string>;
            sortOrder: number;
          };
          userId: string;
        } | null,
        Name
      >;
      getOrg: FunctionReference<
        "query",
        "internal",
        { orgId: string; userId: string },
        {
          _id: string;
          createdBy: string;
          isPersonal?: boolean;
          logoUrl?: string;
          metadata?: Record<string, any>;
          name: string;
          slug: string;
          status: string;
        } | null,
        Name
      >;
      getOrgBySlug: FunctionReference<
        "query",
        "internal",
        { slug: string; userId: string },
        {
          _id: string;
          createdBy: string;
          isPersonal?: boolean;
          logoUrl?: string;
          metadata?: Record<string, any>;
          name: string;
          slug: string;
          status: string;
        } | null,
        Name
      >;
      getOrgDetail: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; orgId: string },
        {
          members: Array<{
            displayName?: string;
            email?: string;
            joinedAt: number;
            roleName: string;
            userId: string;
          }>;
          org: {
            _id: string;
            createdBy: string;
            logoUrl?: string;
            metadata?: Record<string, any>;
            name: string;
            slug: string;
            status: string;
          };
          pendingInvitations: number;
          roles: Array<{
            _id: string;
            isSystem: boolean;
            name: string;
            permissions: Array<string>;
            sortOrder: number;
          }>;
        } | null,
        Name
      >;
      getProfileDetail: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; targetUserId: string },
        {
          devices: Array<{
            _id: string;
            browser?: string;
            deviceName?: string;
            lastActiveAt: number;
            os?: string;
          }>;
          memberships: Array<{
            joinedAt: number;
            orgId: string;
            orgName: string;
            orgSlug: string;
            roleName: string;
          }>;
          profile: {
            _id: string;
            avatarUrl?: string;
            banReason?: string;
            deletedAt?: number;
            displayName?: string;
            email?: string;
            isAdmin: boolean;
            isBanned: boolean;
            lastActiveAt?: number;
            metadata?: Record<string, any>;
            phone?: string;
            userId: string;
          };
        } | null,
        Name
      >;
      getProfileQuery: FunctionReference<
        "query",
        "internal",
        { userId: string },
        {
          _id: string;
          activeOrgId?: string;
          avatarUrl?: string;
          displayName?: string;
          email?: string;
          isAdmin: boolean;
          isBanned: boolean;
          lastActiveAt?: number;
          metadata?: Record<string, any>;
          phone?: string;
          userId: string;
        } | null,
        Name
      >;
      leaveOrg: FunctionReference<
        "mutation",
        "internal",
        { orgId: string; userId: string },
        null,
        Name
      >;
      listAllOrgs: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; limit?: number; search?: string },
        Array<{
          _id: string;
          createdBy: string;
          isPersonal?: boolean;
          memberCount: number;
          name: string;
          slug: string;
          status: string;
        }>,
        Name
      >;
      listAllProfiles: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; limit?: number; search?: string },
        Array<{
          _id: string;
          avatarUrl?: string;
          deletedAt?: number;
          displayName?: string;
          email?: string;
          isAdmin: boolean;
          isBanned: boolean;
          lastActiveAt?: number;
          phone?: string;
          userId: string;
        }>,
        Name
      >;
      listAuditLogs: FunctionReference<
        "query",
        "internal",
        {
          action?: string;
          actorUserId?: string;
          limit?: number;
          orgId: string;
          resourceType?: string;
          userId: string;
        },
        Array<{
          _id: string;
          action: string;
          actorUserId: string;
          effectiveUserId?: string;
          metadata?: Record<string, any>;
          resourceId?: string;
          resourceType: string;
          timestamp: number;
        }>,
        Name
      >;
      listDevices: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          _id: string;
          browser?: string;
          createdAt: number;
          deviceName?: string;
          deviceType?: string;
          ipAddress?: string;
          lastActiveAt: number;
          os?: string;
          sessionId: string;
        }>,
        Name
      >;
      listImpersonationHistory: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; limit?: number; targetUserId?: string },
        Array<{
          _id: string;
          adminUserId: string;
          endedAt?: number;
          expiresAt: number;
          reason?: string;
          startedAt: number;
          status: string;
          targetUserId: string;
        }>,
        Name
      >;
      listInvitations: FunctionReference<
        "query",
        "internal",
        { orgId: string; status?: string; userId: string },
        Array<{
          _id: string;
          acceptedAt?: number;
          acceptedBy?: string;
          email?: string;
          expiresAt: number;
          invitedBy: string;
          phone?: string;
          role: { _id: string; name: string };
          status: string;
        }>,
        Name
      >;
      listMembers: FunctionReference<
        "query",
        "internal",
        { orgId: string; userId: string },
        Array<{
          _id: string;
          invitedBy?: string;
          joinedAt: number;
          profile: {
            avatarUrl?: string;
            displayName?: string;
            email?: string;
          } | null;
          role: {
            _id: string;
            name: string;
            permissions: Array<string>;
            sortOrder: number;
          };
          userId: string;
        }>,
        Name
      >;
      listMembersByOrgInternal: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{ userId: string }>,
        Name
      >;
      listPlatformAuditLogs: FunctionReference<
        "query",
        "internal",
        { action?: string; actorUserId: string; limit?: number },
        Array<{
          _id: string;
          action: string;
          actorUserId: string;
          effectiveUserId?: string;
          metadata?: Record<string, any>;
          orgId?: string;
          resourceId?: string;
          resourceType: string;
          timestamp: number;
        }>,
        Name
      >;
      listRoles: FunctionReference<
        "query",
        "internal",
        { orgId: string; userId: string },
        Array<{
          _id: string;
          description?: string;
          isSystem: boolean;
          name: string;
          permissions: Array<string>;
          sortOrder: number;
        }>,
        Name
      >;
      listUserOrgs: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          _id: string;
          isPersonal?: boolean;
          logoUrl?: string;
          name: string;
          role: {
            _id: string;
            name: string;
            permissions: Array<string>;
            sortOrder: number;
          };
          slug: string;
          status: string;
        }>,
        Name
      >;
      registerDevice: FunctionReference<
        "mutation",
        "internal",
        {
          browser?: string;
          deviceName?: string;
          deviceType?: "web" | "mobile" | "tablet" | "desktop";
          ipAddress?: string;
          os?: string;
          sessionId: string;
          userId: string;
        },
        string,
        Name
      >;
      removeAllOtherDevices: FunctionReference<
        "mutation",
        "internal",
        { currentSessionId: string; userId: string },
        { sessionIds: Array<string> },
        Name
      >;
      removeDevice: FunctionReference<
        "mutation",
        "internal",
        { deviceId: string; userId: string },
        { sessionId: string },
        Name
      >;
      removeMember: FunctionReference<
        "mutation",
        "internal",
        { orgId: string; targetUserId: string; userId: string },
        null,
        Name
      >;
      revokeInvitation: FunctionReference<
        "mutation",
        "internal",
        { invitationId: string; userId: string },
        null,
        Name
      >;
      setActiveOrg: FunctionReference<
        "mutation",
        "internal",
        { orgId?: string; userId: string },
        null,
        Name
      >;
      setAdmin: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; isAdmin: boolean; targetUserId: string },
        null,
        Name
      >;
      startImpersonation: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          reason?: string;
          targetUserId: string;
          ttlMs: number;
        },
        string,
        Name
      >;
      stopImpersonation: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string },
        null,
        Name
      >;
      syncUser: FunctionReference<
        "mutation",
        "internal",
        {
          email?: string;
          migrationLinking?: boolean;
          name?: string;
          phone?: string;
          userId: string;
        },
        string,
        Name
      >;
      transferOwnership: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; newOwnerUserId: string; orgId: string },
        null,
        Name
      >;
      unbanUser: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; targetUserId: string },
        null,
        Name
      >;
      updateDeviceActivity: FunctionReference<
        "mutation",
        "internal",
        { sessionId: string; userId: string },
        null,
        Name
      >;
      updateMemberRole: FunctionReference<
        "mutation",
        "internal",
        { orgId: string; roleId: string; targetUserId: string; userId: string },
        null,
        Name
      >;
      updateOrg: FunctionReference<
        "mutation",
        "internal",
        {
          logoUrl?: string;
          metadata?: Record<string, any>;
          name?: string;
          orgId: string;
          slug?: string;
          userId: string;
        },
        null,
        Name
      >;
      updateProfile: FunctionReference<
        "mutation",
        "internal",
        {
          avatarUrl?: string;
          displayName?: string;
          metadata?: Record<string, any>;
          userId: string;
        },
        null,
        Name
      >;
      updateRole: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string;
          name?: string;
          orgId: string;
          permissions?: Array<string>;
          roleId: string;
          sortOrder?: number;
          userId: string;
        },
        null,
        Name
      >;
    };
  };
