import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";
import type { UserOrgConfig } from "./types.js";
import { parseUserAgent } from "./callbacks.js";

/**
 * Creates the user-facing organization API.
 * Returns an object of query/mutation exports that extract userId from auth,
 * resolve impersonation, and delegate to the component.
 */
export function createUserOrgAPI(component: any, config: UserOrgConfig) {
  const invitationExpiryMs = config.invitationExpiryMs ?? 7 * 24 * 60 * 60 * 1000;

  async function getAuthUserId(ctx: any): Promise<string> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const [userId] = identity.subject.split("|");
    return userId;
  }

  async function resolveEffectiveUserId(
    ctx: any,
    actorUserId: string,
  ): Promise<{ actorUserId: string; effectiveUserId: string }> {
    const impersonation = await ctx.runQuery(
      component.lib.getActiveImpersonation,
      { actorUserId },
    );
    if (impersonation) {
      return { actorUserId, effectiveUserId: impersonation.targetUserId };
    }
    return { actorUserId, effectiveUserId: actorUserId };
  }

  async function hashToken(token: string): Promise<string> {
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token),
    );
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function checkBan(ctx: any, userId: string): Promise<void> {
    const profile = await ctx.runQuery(component.lib.getProfileQuery, {
      userId,
    });
    if (!profile) {
      throw new Error("Account not found or has been deleted");
    }
    if (profile.isBanned) {
      throw new Error("Account is banned");
    }
  }

  return {
    // =====================================================================
    // PROFILE
    // =====================================================================

    getMyProfile: queryGeneric({
      args: {},
      returns: v.union(
        v.object({
          _id: v.string(),
          userId: v.string(),
          email: v.optional(v.string()),
          phone: v.optional(v.string()),
          displayName: v.optional(v.string()),
          avatarUrl: v.optional(v.string()),
          metadata: v.optional(v.record(v.string(), v.any())),
          activeOrgId: v.optional(v.string()),
          lastActiveAt: v.optional(v.number()),
          isBanned: v.boolean(),
          isAdmin: v.boolean(),
        }),
        v.null(),
      ),
      handler: async (ctx: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.getProfileQuery, {
          userId: effectiveUserId,
        });
      },
    }),

    updateMyProfile: mutationGeneric({
      args: {
        displayName: v.optional(v.string()),
        avatarUrl: v.optional(v.string()),
        metadata: v.optional(v.record(v.string(), v.any())),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.updateProfile, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),

    setActiveOrg: mutationGeneric({
      args: { orgId: v.optional(v.string()) },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.setActiveOrg, {
          userId: effectiveUserId,
          orgId: args.orgId,
        });
      },
    }),

    // =====================================================================
    // ORGANIZATIONS
    // =====================================================================

    createOrg: mutationGeneric({
      args: {
        name: v.string(),
        slug: v.string(),
        metadata: v.optional(v.record(v.string(), v.any())),
        isPersonal: v.optional(v.boolean()),
      },
      returns: v.string(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        return await ctx.runMutation(component.lib.createOrg, {
          userId,
          name: args.name,
          slug: args.slug,
          metadata: args.metadata,
          isPersonal: args.isPersonal,
          systemRoles: config.roles,
        });
      },
    }),

    getOrg: queryGeneric({
      args: { orgId: v.string() },
      returns: v.union(
        v.object({
          _id: v.string(),
          name: v.string(),
          slug: v.string(),
          logoUrl: v.optional(v.string()),
          metadata: v.optional(v.record(v.string(), v.any())),
          createdBy: v.string(),
          isPersonal: v.optional(v.boolean()),
          status: v.string(),
        }),
        v.null(),
      ),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.getOrg, {
          userId: effectiveUserId,
          orgId: args.orgId,
        });
      },
    }),

    getOrgBySlug: queryGeneric({
      args: { slug: v.string() },
      returns: v.union(
        v.object({
          _id: v.string(),
          name: v.string(),
          slug: v.string(),
          logoUrl: v.optional(v.string()),
          metadata: v.optional(v.record(v.string(), v.any())),
          createdBy: v.string(),
          isPersonal: v.optional(v.boolean()),
          status: v.string(),
        }),
        v.null(),
      ),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.getOrgBySlug, {
          userId: effectiveUserId,
          slug: args.slug,
        });
      },
    }),

    updateOrg: mutationGeneric({
      args: {
        orgId: v.string(),
        name: v.optional(v.string()),
        slug: v.optional(v.string()),
        logoUrl: v.optional(v.string()),
        metadata: v.optional(v.record(v.string(), v.any())),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.updateOrg, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),

    deleteOrg: mutationGeneric({
      args: { orgId: v.string() },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.deleteOrg, {
          userId: effectiveUserId,
          orgId: args.orgId,
        });
      },
    }),

    listMyOrgs: queryGeneric({
      args: {},
      returns: v.array(
        v.object({
          _id: v.string(),
          name: v.string(),
          slug: v.string(),
          logoUrl: v.optional(v.string()),
          isPersonal: v.optional(v.boolean()),
          status: v.string(),
          role: v.object({
            _id: v.string(),
            name: v.string(),
            permissions: v.array(v.string()),
            sortOrder: v.number(),
          }),
        }),
      ),
      handler: async (ctx: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.listUserOrgs, {
          userId: effectiveUserId,
        });
      },
    }),

    // =====================================================================
    // ROLES
    // =====================================================================

    listRoles: queryGeneric({
      args: { orgId: v.string() },
      returns: v.array(
        v.object({
          _id: v.string(),
          name: v.string(),
          description: v.optional(v.string()),
          permissions: v.array(v.string()),
          isSystem: v.boolean(),
          sortOrder: v.number(),
        }),
      ),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.listRoles, {
          userId: effectiveUserId,
          orgId: args.orgId,
        });
      },
    }),

    createRole: mutationGeneric({
      args: {
        orgId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        permissions: v.array(v.string()),
        sortOrder: v.number(),
      },
      returns: v.string(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.createRole, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),

    updateRole: mutationGeneric({
      args: {
        orgId: v.string(),
        roleId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        permissions: v.optional(v.array(v.string())),
        sortOrder: v.optional(v.number()),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.updateRole, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),

    deleteRole: mutationGeneric({
      args: {
        orgId: v.string(),
        roleId: v.string(),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.deleteRole, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),

    // =====================================================================
    // MEMBERS
    // =====================================================================

    listMembers: queryGeneric({
      args: { orgId: v.string() },
      returns: v.array(
        v.object({
          _id: v.string(),
          userId: v.string(),
          joinedAt: v.number(),
          invitedBy: v.optional(v.string()),
          role: v.object({
            _id: v.string(),
            name: v.string(),
            permissions: v.array(v.string()),
            sortOrder: v.number(),
          }),
          profile: v.union(
            v.object({
              displayName: v.optional(v.string()),
              email: v.optional(v.string()),
              avatarUrl: v.optional(v.string()),
            }),
            v.null(),
          ),
        }),
      ),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.listMembers, {
          userId: effectiveUserId,
          orgId: args.orgId,
        });
      },
    }),

    getMyMembership: queryGeneric({
      args: { orgId: v.string() },
      returns: v.union(
        v.object({
          _id: v.string(),
          userId: v.string(),
          joinedAt: v.number(),
          role: v.object({
            _id: v.string(),
            name: v.string(),
            permissions: v.array(v.string()),
            sortOrder: v.number(),
          }),
        }),
        v.null(),
      ),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.getMembershipQuery, {
          userId: effectiveUserId,
          orgId: args.orgId,
        });
      },
    }),

    updateMemberRole: mutationGeneric({
      args: {
        orgId: v.string(),
        targetUserId: v.string(),
        roleId: v.string(),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.updateMemberRole, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),

    removeMember: mutationGeneric({
      args: {
        orgId: v.string(),
        targetUserId: v.string(),
      },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.removeMember, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),

    leaveOrg: mutationGeneric({
      args: { orgId: v.string() },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.leaveOrg, {
          userId: effectiveUserId,
          orgId: args.orgId,
        });
      },
    }),

    // =====================================================================
    // INVITATIONS
    // =====================================================================

    createInvitation: mutationGeneric({
      args: {
        orgId: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        roleId: v.string(),
      },
      returns: v.object({
        invitationId: v.string(),
        token: v.string(),
      }),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);

        // Generate a crypto-safe token and hash it for storage
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        const rawToken = Array.from(tokenBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const tokenHash = await hashToken(rawToken);

        const expiresAt = Date.now() + invitationExpiryMs;

        const invitationId = await ctx.runMutation(
          component.lib.createInvitation,
          {
            userId,
            orgId: args.orgId,
            email: args.email,
            phone: args.phone,
            roleId: args.roleId,
            tokenHash,
            expiresAt,
          },
        );

        return { invitationId, token: rawToken };
      },
    }),

    listInvitations: queryGeneric({
      args: {
        orgId: v.string(),
        status: v.optional(v.string()),
      },
      returns: v.array(
        v.object({
          _id: v.string(),
          email: v.optional(v.string()),
          phone: v.optional(v.string()),
          status: v.string(),
          invitedBy: v.string(),
          expiresAt: v.number(),
          acceptedBy: v.optional(v.string()),
          acceptedAt: v.optional(v.number()),
          role: v.object({
            _id: v.string(),
            name: v.string(),
          }),
        }),
      ),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.listInvitations, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),

    revokeInvitation: mutationGeneric({
      args: { invitationId: v.string() },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        return await ctx.runMutation(component.lib.revokeInvitation, {
          userId,
          invitationId: args.invitationId,
        });
      },
    }),

    getInvitationByToken: queryGeneric({
      args: { token: v.string() },
      returns: v.union(
        v.object({
          _id: v.string(),
          orgId: v.string(),
          orgName: v.string(),
          orgSlug: v.string(),
          email: v.optional(v.string()),
          phone: v.optional(v.string()),
          status: v.string(),
          expiresAt: v.number(),
          roleName: v.string(),
        }),
        v.null(),
      ),
      handler: async (ctx: any, args: any) => {
        const tokenHash = await hashToken(args.token);
        return await ctx.runQuery(component.lib.getInvitationByToken, {
          tokenHash,
        });
      },
    }),

    acceptInvitation: mutationGeneric({
      args: { token: v.string() },
      returns: v.object({
        orgId: v.string(),
        memberId: v.string(),
      }),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const tokenHash = await hashToken(args.token);
        return await ctx.runMutation(component.lib.acceptInvitation, {
          userId,
          tokenHash,
        });
      },
    }),

    declineInvitation: mutationGeneric({
      args: { token: v.string() },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const tokenHash = await hashToken(args.token);
        return await ctx.runMutation(component.lib.declineInvitation, {
          userId,
          tokenHash,
        });
      },
    }),

    // =====================================================================
    // INVITATION CODES
    // =====================================================================

    createInvitationCode: mutationGeneric({
      args: {
        orgId: v.string(),
        roleId: v.string(),
        maxRedemptions: v.optional(v.number()),
        expiresAt: v.optional(v.number()),
      },
      returns: v.object({
        _id: v.string(),
        code: v.string(),
      }),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);

        return await ctx.runMutation(component.lib.createInvitationCode, {
          userId,
          orgId: args.orgId,
          roleId: args.roleId,
          maxRedemptions: args.maxRedemptions,
          expiresAt: args.expiresAt,
        });
      },
    }),

    listInvitationCodes: queryGeneric({
      args: {
        orgId: v.string(),
        status: v.optional(v.string()),
      },
      returns: v.array(
        v.object({
          _id: v.string(),
          code: v.string(),
          createdBy: v.string(),
          maxRedemptions: v.optional(v.number()),
          redemptionCount: v.number(),
          expiresAt: v.optional(v.number()),
          status: v.string(),
          role: v.object({
            _id: v.string(),
            name: v.string(),
          }),
        }),
      ),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.listInvitationCodes, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),

    getInvitationCodeByCode: queryGeneric({
      args: { code: v.string() },
      returns: v.union(
        v.object({
          _id: v.string(),
          orgId: v.string(),
          orgName: v.string(),
          orgSlug: v.string(),
          status: v.string(),
          roleName: v.string(),
          maxRedemptions: v.optional(v.number()),
          redemptionCount: v.number(),
          expiresAt: v.optional(v.number()),
        }),
        v.null(),
      ),
      handler: async (ctx: any, args: any) => {
        return await ctx.runQuery(component.lib.getInvitationCodeByCode, {
          code: args.code,
        });
      },
    }),

    redeemInvitationCode: mutationGeneric({
      args: { code: v.string() },
      returns: v.object({
        orgId: v.string(),
        memberId: v.string(),
      }),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        return await ctx.runMutation(component.lib.redeemInvitationCode, {
          userId,
          code: args.code,
        });
      },
    }),

    revokeInvitationCode: mutationGeneric({
      args: { invitationCodeId: v.string() },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        return await ctx.runMutation(component.lib.revokeInvitationCode, {
          userId,
          invitationCodeId: args.invitationCodeId,
        });
      },
    }),

    // =====================================================================
    // DEVICES
    // =====================================================================

    getCurrentSessionId: queryGeneric({
      args: {},
      returns: v.union(v.string(), v.null()),
      handler: async (ctx: any) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;
        const parts = identity.subject.split("|");
        return parts[1] ?? null;
      },
    }),

    registerDevice: mutationGeneric({
      args: { userAgent: v.optional(v.string()) },
      returns: v.null(),
      handler: async (ctx: any, args: any) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;
        const parts = identity.subject.split("|");
        const userId = parts[0];
        const sessionId = parts[1];
        if (!userId || !sessionId) return null;

        const deviceInfo = args.userAgent ? parseUserAgent(args.userAgent) : {};

        await ctx.runMutation(component.lib.registerDevice, {
          userId,
          sessionId,
          ...deviceInfo,
        });
        return null;
      },
    }),

    listMyDevices: queryGeneric({
      args: {},
      returns: v.array(
        v.object({
          _id: v.string(),
          sessionId: v.string(),
          deviceName: v.optional(v.string()),
          deviceType: v.optional(v.string()),
          browser: v.optional(v.string()),
          os: v.optional(v.string()),
          ipAddress: v.optional(v.string()),
          lastActiveAt: v.number(),
          createdAt: v.number(),
        }),
      ),
      handler: async (ctx: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.listDevices, {
          userId: effectiveUserId,
        });
      },
    }),

    removeDevice: mutationGeneric({
      args: { deviceId: v.string() },
      returns: v.object({ sessionId: v.string() }),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.removeDevice, {
          userId: effectiveUserId,
          deviceId: args.deviceId,
        });
        // NOTE: The host app should invalidate the auth session
        // using the returned sessionId after calling this.
      },
    }),

    removeAllOtherDevices: mutationGeneric({
      args: { currentSessionId: v.string() },
      returns: v.object({ sessionIds: v.array(v.string()) }),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        await checkBan(ctx, userId);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runMutation(component.lib.removeAllOtherDevices, {
          userId: effectiveUserId,
          currentSessionId: args.currentSessionId,
        });
        // NOTE: The host app should invalidate all returned sessionIds.
      },
    }),

    // =====================================================================
    // PERMISSIONS
    // =====================================================================

    checkPermission: queryGeneric({
      args: {
        orgId: v.string(),
        permission: v.string(),
      },
      returns: v.boolean(),
      handler: async (ctx: any, args: any) => {
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.checkPermissionQuery, {
          userId: effectiveUserId,
          orgId: args.orgId,
          permission: args.permission,
        });
      },
    }),

    // =====================================================================
    // AUDIT LOGS
    // =====================================================================

    listAuditLogs: queryGeneric({
      args: {
        orgId: v.string(),
        action: v.optional(v.string()),
        actorUserId: v.optional(v.string()),
        resourceType: v.optional(v.string()),
        limit: v.optional(v.number()),
      },
      returns: v.array(
        v.object({
          _id: v.string(),
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
        const userId = await getAuthUserId(ctx);
        const { effectiveUserId } = await resolveEffectiveUserId(ctx, userId);
        return await ctx.runQuery(component.lib.listAuditLogs, {
          userId: effectiveUserId,
          ...args,
        });
      },
    }),
  };
}
