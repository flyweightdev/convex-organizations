import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

/**
 * Creates the admin API.
 * All functions verify the caller is a platform admin (isAdmin: true).
 */
export function createAdminAPI(
  component: any,
  config?: { impersonationTtlMs?: number },
) {
  const impersonationTtlMs = config?.impersonationTtlMs ?? 60 * 60 * 1000;
  async function getAuthUserId(ctx: any): Promise<string> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const [userId] = identity.subject.split("|");
    return userId;
  }

  return {
    // =====================================================================
    // USER MANAGEMENT
    // =====================================================================

    listAllUsers: queryGeneric({
      args: {
        limit: v.optional(v.number()),
        search: v.optional(v.string()),
      },
      returns: v.array(
        v.object({
          _id: v.string(),
          userId: v.string(),
          email: v.optional(v.string()),
          phone: v.optional(v.string()),
          displayName: v.optional(v.string()),
          avatarUrl: v.optional(v.string()),
          isBanned: v.boolean(),
          isAdmin: v.boolean(),
          lastActiveAt: v.optional(v.number()),
          deletedAt: v.optional(v.number()),
        }),
      ),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runQuery(component.lib.listAllProfiles, {
          actorUserId,
          ...args,
        });
      },
    }),

    getUserDetail: queryGeneric({
      args: { targetUserId: v.string() },
      returns: v.union(
        v.object({
          profile: v.object({
            _id: v.string(),
            userId: v.string(),
            email: v.optional(v.string()),
            phone: v.optional(v.string()),
            displayName: v.optional(v.string()),
            avatarUrl: v.optional(v.string()),
            metadata: v.optional(v.record(v.string(), v.any())),
            isBanned: v.boolean(),
            banReason: v.optional(v.string()),
            isAdmin: v.boolean(),
            lastActiveAt: v.optional(v.number()),
            deletedAt: v.optional(v.number()),
          }),
          memberships: v.array(
            v.object({
              orgId: v.string(),
              orgName: v.string(),
              orgSlug: v.string(),
              roleName: v.string(),
              joinedAt: v.number(),
            }),
          ),
          devices: v.array(
            v.object({
              _id: v.string(),
              deviceName: v.optional(v.string()),
              browser: v.optional(v.string()),
              os: v.optional(v.string()),
              lastActiveAt: v.number(),
            }),
          ),
        }),
        v.null(),
      ),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runQuery(component.lib.getProfileDetail, {
          actorUserId,
          targetUserId: args.targetUserId,
        });
      },
    }),

    banUser: mutationGeneric({
      args: {
        targetUserId: v.string(),
        reason: v.string(),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runMutation(component.lib.banUser, {
          actorUserId,
          ...args,
        });
      },
    }),

    unbanUser: mutationGeneric({
      args: { targetUserId: v.string() },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runMutation(component.lib.unbanUser, {
          actorUserId,
          targetUserId: args.targetUserId,
        });
      },
    }),

    setAdmin: mutationGeneric({
      args: {
        targetUserId: v.string(),
        isAdmin: v.boolean(),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runMutation(component.lib.setAdmin, {
          actorUserId,
          ...args,
        });
      },
    }),

    deleteUser: mutationGeneric({
      args: { targetUserId: v.string() },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runMutation(component.lib.deleteUser, {
          userId: args.targetUserId,
          actorUserId,
        });
      },
    }),

    // =====================================================================
    // ORG MANAGEMENT
    // =====================================================================

    listAllOrgs: queryGeneric({
      args: {
        limit: v.optional(v.number()),
        search: v.optional(v.string()),
      },
      returns: v.array(
        v.object({
          _id: v.string(),
          name: v.string(),
          slug: v.string(),
          status: v.string(),
          createdBy: v.string(),
          isPersonal: v.optional(v.boolean()),
          memberCount: v.number(),
        }),
      ),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runQuery(component.lib.listAllOrgs, {
          actorUserId,
          ...args,
        });
      },
    }),

    getOrgDetail: queryGeneric({
      args: { orgId: v.string() },
      returns: v.union(
        v.object({
          org: v.object({
            _id: v.string(),
            name: v.string(),
            slug: v.string(),
            logoUrl: v.optional(v.string()),
            metadata: v.optional(v.record(v.string(), v.any())),
            status: v.string(),
            createdBy: v.string(),
          }),
          members: v.array(
            v.object({
              userId: v.string(),
              displayName: v.optional(v.string()),
              email: v.optional(v.string()),
              roleName: v.string(),
              joinedAt: v.number(),
            }),
          ),
          roles: v.array(
            v.object({
              _id: v.string(),
              name: v.string(),
              permissions: v.array(v.string()),
              isSystem: v.boolean(),
              sortOrder: v.number(),
            }),
          ),
          pendingInvitations: v.number(),
        }),
        v.null(),
      ),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runQuery(component.lib.getOrgDetail, {
          actorUserId,
          orgId: args.orgId,
        });
      },
    }),

    forceRemoveMember: mutationGeneric({
      args: {
        orgId: v.string(),
        targetUserId: v.string(),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runMutation(component.lib.forceRemoveMember, {
          actorUserId,
          ...args,
        });
      },
    }),

    transferOwnership: mutationGeneric({
      args: {
        orgId: v.string(),
        newOwnerUserId: v.string(),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runMutation(component.lib.transferOwnership, {
          actorUserId,
          ...args,
        });
      },
    }),

    // =====================================================================
    // IMPERSONATION
    // =====================================================================

    startImpersonation: mutationGeneric({
      args: {
        targetUserId: v.string(),
        reason: v.optional(v.string()),
      },
      returns: v.string(),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runMutation(component.lib.startImpersonation, {
          actorUserId,
          targetUserId: args.targetUserId,
          reason: args.reason,
          ttlMs: impersonationTtlMs,
        });
      },
    }),

    stopImpersonation: mutationGeneric({
      args: {},
      returns: v.null(),
      handler: async (ctx: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runMutation(component.lib.stopImpersonation, {
          actorUserId,
        });
      },
    }),

    getActiveImpersonation: queryGeneric({
      args: {},
      returns: v.union(
        v.object({
          _id: v.string(),
          targetUserId: v.string(),
          reason: v.optional(v.string()),
          startedAt: v.number(),
          expiresAt: v.number(),
        }),
        v.null(),
      ),
      handler: async (ctx: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runQuery(component.lib.getActiveImpersonation, {
          actorUserId,
        });
      },
    }),

    listImpersonationHistory: queryGeneric({
      args: {
        targetUserId: v.optional(v.string()),
        limit: v.optional(v.number()),
      },
      returns: v.array(
        v.object({
          _id: v.string(),
          adminUserId: v.string(),
          targetUserId: v.string(),
          reason: v.optional(v.string()),
          startedAt: v.number(),
          expiresAt: v.number(),
          endedAt: v.optional(v.number()),
          status: v.string(),
        }),
      ),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runQuery(component.lib.listImpersonationHistory, {
          actorUserId,
          ...args,
        });
      },
    }),

    // =====================================================================
    // PLATFORM AUDIT
    // =====================================================================

    listPlatformAuditLogs: queryGeneric({
      args: {
        action: v.optional(v.string()),
        limit: v.optional(v.number()),
      },
      returns: v.array(
        v.object({
          _id: v.string(),
          orgId: v.optional(v.string()),
          actorUserId: v.string(),
          effectiveUserId: v.optional(v.string()),
          action: v.string(),
          resourceType: v.string(),
          resourceId: v.optional(v.string()),
          metadata: v.optional(v.record(v.string(), v.any())),
          timestamp: v.number(),
        }),
      ),
      handler: async (ctx: any, args: any) => {
        const actorUserId = await getAuthUserId(ctx);
        return await ctx.runQuery(component.lib.listPlatformAuditLogs, {
          actorUserId,
          ...args,
        });
      },
    }),
  };
}
