import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server.js";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import {
  getProfile,
  getProfileIncludingDeleted,
  requireProfile,
  getMembership,
  requireMembership,
  requirePermission,
  requireOrg,
  requireAdmin,
  getRoleByName,
  hasPermission,
  canManageRole,
  writeAuditLog,
} from "./helpers.js";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const INVITATION_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateInvitationCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => INVITATION_CODE_CHARS[b % INVITATION_CODE_CHARS.length])
    .join("");
}

// ============================================================================
// USER PROFILES
// ============================================================================

export const syncUser = mutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    name: v.optional(v.string()),
    migrationLinking: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Migration linking: before syncing, check if a profile exists for this
    // email with a temp userId (the email itself from pre-migration seeding).
    // If so, remap it to the real Convex Auth userId.
    if (args.migrationLinking && args.email) {
      const existingProfiles = await ctx.db
        .query("userProfiles")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .take(3);
      const activeProfile = existingProfiles.find((p) => p.deletedAt === undefined);

      if (
        activeProfile &&
        activeProfile.userId !== args.userId &&
        activeProfile.userId === args.email
      ) {
        // Remap the temp userId to the real one across all tables.
        // Check no profile already exists for the real userId
        const realProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .unique();
        if (!realProfile) {
          // 1. Update profile
          await ctx.db.patch(activeProfile._id, { userId: args.userId });

          // 2. Update orgMembers.userId
          const members = await ctx.db
            .query("orgMembers")
            .withIndex("by_user", (q) => q.eq("userId", args.email!))
            .collect();
          for (const m of members) {
            await ctx.db.patch(m._id, { userId: args.userId });
          }

          // 3. Update orgMembers.invitedBy
          const invitedByMembers = await ctx.db
            .query("orgMembers")
            .withIndex("by_invitedBy", (q) => q.eq("invitedBy", args.email!))
            .collect();
          for (const m of invitedByMembers) {
            await ctx.db.patch(m._id, { invitedBy: args.userId });
          }

          // 4. Update invitations.invitedBy
          const invitedByInvs = await ctx.db
            .query("invitations")
            .withIndex("by_invitedBy", (q) => q.eq("invitedBy", args.email!))
            .collect();
          for (const inv of invitedByInvs) {
            await ctx.db.patch(inv._id, { invitedBy: args.userId });
          }

          // 5. Update invitations.acceptedBy
          const acceptedByInvs = await ctx.db
            .query("invitations")
            .withIndex("by_acceptedBy", (q) => q.eq("acceptedBy", args.email!))
            .collect();
          for (const inv of acceptedByInvs) {
            await ctx.db.patch(inv._id, { acceptedBy: args.userId });
          }

          // 6. Update auditLogs.actorUserId
          const actorLogs = await ctx.db
            .query("auditLogs")
            .withIndex("by_actor", (q) => q.eq("actorUserId", args.email!))
            .collect();
          for (const log of actorLogs) {
            await ctx.db.patch(log._id, { actorUserId: args.userId });
          }

          // 7. Update auditLogs.effectiveUserId
          const effectiveLogs = await ctx.db
            .query("auditLogs")
            .withIndex("by_effectiveUserId", (q) => q.eq("effectiveUserId", args.email!))
            .collect();
          for (const log of effectiveLogs) {
            await ctx.db.patch(log._id, { effectiveUserId: args.userId });
          }

          // 8. Update organizations.createdBy
          const orgs = await ctx.db
            .query("organizations")
            .withIndex("by_createdBy", (q) => q.eq("createdBy", args.email!))
            .collect();
          for (const org of orgs) {
            await ctx.db.patch(org._id, { createdBy: args.userId });
          }
        }
      }
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.email !== undefined && { email: args.email }),
        ...(args.phone !== undefined && { phone: args.phone }),
        ...(args.name !== undefined && { displayName: args.name }),
        lastActiveAt: Date.now(),
      });
      return existing._id;
    }

    const profileId = await ctx.db.insert("userProfiles", {
      userId: args.userId,
      email: args.email,
      phone: args.phone,
      displayName: args.name,
      isBanned: false,
      isAdmin: false,
      lastActiveAt: Date.now(),
    });
    return profileId;
  },
});

export const getProfileQuery = query({
  args: { userId: v.string() },
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
  handler: async (ctx, args) => {
    const profile = await getProfile(ctx, args.userId);
    if (!profile) return null;
    return {
      _id: profile._id as string,
      userId: profile.userId,
      email: profile.email,
      phone: profile.phone,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      metadata: profile.metadata,
      activeOrgId: profile.activeOrgId as string | undefined,
      lastActiveAt: profile.lastActiveAt,
      isBanned: profile.isBanned,
      isAdmin: profile.isAdmin,
    };
  },
});

export const updateProfile = mutation({
  args: {
    userId: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.userId);
    const updates: Record<string, unknown> = {};
    if (args.displayName !== undefined) updates.displayName = args.displayName;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
    if (args.metadata !== undefined) updates.metadata = args.metadata;

    await ctx.db.patch(profile._id, updates);

    await writeAuditLog(ctx, {
      actorUserId: args.userId,
      action: "profile.updated",
      resourceType: "profile",
      resourceId: profile._id as string,
      metadata: { fields: Object.keys(updates) },
    });
    return null;
  },
});

export const setActiveOrg = mutation({
  args: {
    userId: v.string(),
    orgId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.userId);

    if (args.orgId) {
      const orgId = args.orgId as Id<"organizations">;
      await requireMembership(ctx, orgId, args.userId);
      await ctx.db.patch(profile._id, { activeOrgId: orgId });
    } else {
      await ctx.db.patch(profile._id, { activeOrgId: undefined });
    }
    return null;
  },
});

export const deleteUser = mutation({
  args: {
    userId: v.string(),
    actorUserId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // If called from admin context, verify admin atomically
    if (args.actorUserId) {
      await requireAdmin(ctx, args.actorUserId);
    }

    const profile = await getProfileIncludingDeleted(ctx, args.userId);
    if (!profile || profile.deletedAt) return null;

    // Immediately remove memberships (they affect active org operations)
    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }

    // Immediately remove devices (operational data)
    const devices = await ctx.db
      .query("userDevices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    for (const d of devices) {
      await ctx.db.delete(d._id);
    }

    // Soft-delete: mark profile for deferred purge
    await ctx.db.patch(profile._id, {
      deletedAt: Date.now(),
      activeOrgId: undefined,
    });

    await writeAuditLog(ctx, {
      actorUserId: args.actorUserId ?? args.userId,
      action: "profile.deleted",
      resourceType: "profile",
      resourceId: profile._id as string,
      metadata: args.actorUserId
        ? { deletedUserId: args.userId }
        : undefined,
    });
    return null;
  },
});

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export const createOrg = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    slug: v.string(),
    metadata: v.optional(v.record(v.string(), v.any())),
    isPersonal: v.optional(v.boolean()),
    systemRoles: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        permissions: v.array(v.string()),
        sortOrder: v.number(),
        isSystem: v.boolean(),
      }),
    ),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Verify slug uniqueness
    const existingSlug = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existingSlug) {
      throw new Error("Organization slug already taken");
    }

    // Create org
    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      metadata: args.metadata,
      createdBy: args.userId,
      isPersonal: args.isPersonal,
      status: "active",
    });

    // Seed system roles
    let ownerRoleId: Id<"orgRoles"> | null = null;
    for (const role of args.systemRoles) {
      const roleId = await ctx.db.insert("orgRoles", {
        orgId,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        sortOrder: role.sortOrder,
      });
      if (role.name === "owner") {
        ownerRoleId = roleId;
      }
    }

    if (!ownerRoleId) {
      throw new Error("System roles must include an 'owner' role");
    }

    // Add creator as owner
    await ctx.db.insert("orgMembers", {
      orgId,
      userId: args.userId,
      roleId: ownerRoleId,
      joinedAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "org.created",
      resourceType: "organization",
      resourceId: orgId as string,
      metadata: { name: args.name, slug: args.slug },
    });

    return orgId as string;
  },
});

export const getOrg = query({
  args: {
    userId: v.string(),
    orgId: v.string(),
  },
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
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    const membership = await getMembership(ctx, orgId, args.userId);
    if (!membership) return null;

    const org = await ctx.db.get(orgId);
    if (!org || org.status === "deleted") return null;

    return {
      _id: org._id as string,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      metadata: org.metadata,
      createdBy: org.createdBy,
      isPersonal: org.isPersonal,
      status: org.status,
    };
  },
});

export const getOrgBySlug = query({
  args: {
    userId: v.string(),
    slug: v.string(),
  },
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
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!org || org.status === "deleted") return null;

    const membership = await getMembership(ctx, org._id, args.userId);
    if (!membership) return null;

    return {
      _id: org._id as string,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      metadata: org.metadata,
      createdBy: org.createdBy,
      isPersonal: org.isPersonal,
      status: org.status,
    };
  },
});

export const updateOrg = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    await requirePermission(ctx, orgId, args.userId, "org:write");
    const org = await requireOrg(ctx, orgId);

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.logoUrl !== undefined) updates.logoUrl = args.logoUrl;
    if (args.metadata !== undefined) updates.metadata = args.metadata;

    if (args.slug !== undefined && args.slug !== org.slug) {
      const existing = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug!))
        .first();
      if (existing) {
        throw new Error("Organization slug already taken");
      }
      updates.slug = args.slug;
    }

    await ctx.db.patch(orgId, updates);

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "org.updated",
      resourceType: "organization",
      resourceId: orgId as string,
      metadata: { fields: Object.keys(updates) },
    });
    return null;
  },
});

export const deleteOrg = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    const membership = await requireMembership(ctx, orgId, args.userId);

    // Only owner can delete
    if (membership.role.name !== "owner") {
      throw new Error("Only the organization owner can delete it");
    }

    await ctx.db.patch(orgId, { status: "deleted", deletedAt: Date.now() });

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "org.deleted",
      resourceType: "organization",
      resourceId: orgId as string,
    });
    return null;
  },
});

export const listUserOrgs = query({
  args: { userId: v.string() },
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
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const results = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      if (!org || org.status === "deleted") continue;

      const role = await ctx.db.get(m.roleId);
      if (!role) continue;

      results.push({
        _id: org._id as string,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        isPersonal: org.isPersonal,
        status: org.status,
        role: {
          _id: role._id as string,
          name: role.name,
          permissions: role.permissions,
          sortOrder: role.sortOrder,
        },
      });
    }
    return results;
  },
});

// ============================================================================
// ROLES
// ============================================================================

export const listRoles = query({
  args: {
    userId: v.string(),
    orgId: v.string(),
  },
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
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    await requirePermission(ctx, orgId, args.userId, "role:read");

    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(100);

    return roles.map((r) => ({
      _id: r._id as string,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isSystem: r.isSystem,
      sortOrder: r.sortOrder,
    }));
  },
});

export const createRole = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    sortOrder: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    const membership = await requirePermission(
      ctx,
      orgId,
      args.userId,
      "role:manage",
    );

    // Can't create a role with higher authority than your own
    if (args.sortOrder < membership.role.sortOrder) {
      throw new Error("Cannot create a role with higher authority than your own");
    }

    // Check for duplicate name
    const existing = await getRoleByName(ctx, orgId, args.name);
    if (existing) {
      throw new Error(`Role "${args.name}" already exists in this organization`);
    }

    const roleId = await ctx.db.insert("orgRoles", {
      orgId,
      name: args.name,
      description: args.description,
      permissions: args.permissions,
      isSystem: false,
      sortOrder: args.sortOrder,
    });

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "role.created",
      resourceType: "role",
      resourceId: roleId as string,
      metadata: { name: args.name, permissions: args.permissions },
    });

    return roleId as string;
  },
});

export const updateRole = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
    roleId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    sortOrder: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    const membership = await requirePermission(
      ctx,
      orgId,
      args.userId,
      "role:manage",
    );

    const roleId = args.roleId as Id<"orgRoles">;
    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== orgId) {
      throw new Error("Role not found");
    }

    // Cannot rename system roles
    if (role.isSystem && args.name !== undefined && args.name !== role.name) {
      throw new Error("Cannot rename system roles");
    }

    // Check for duplicate name when renaming
    if (args.name !== undefined && args.name !== role.name) {
      const existing = await getRoleByName(ctx, orgId, args.name);
      if (existing) {
        throw new Error(
          `Role "${args.name}" already exists in this organization`,
        );
      }
    }

    // Cannot set sortOrder higher than your own authority
    if (
      args.sortOrder !== undefined &&
      args.sortOrder < membership.role.sortOrder
    ) {
      throw new Error(
        "Cannot set role authority higher than your own",
      );
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.permissions !== undefined) updates.permissions = args.permissions;
    if (args.sortOrder !== undefined) updates.sortOrder = args.sortOrder;

    await ctx.db.patch(roleId, updates);

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "role.updated",
      resourceType: "role",
      resourceId: roleId as string,
      metadata: { fields: Object.keys(updates) },
    });
    return null;
  },
});

export const deleteRole = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
    roleId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    await requirePermission(ctx, orgId, args.userId, "role:manage");

    const roleId = args.roleId as Id<"orgRoles">;
    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== orgId) {
      throw new Error("Role not found");
    }

    if (role.isSystem) {
      throw new Error("Cannot delete system roles");
    }

    // Check if any members have this role
    const membersWithRole = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_role", (q) =>
        q.eq("orgId", orgId).eq("roleId", roleId),
      )
      .first();
    if (membersWithRole) {
      throw new Error(
        "Cannot delete a role that is assigned to members. Reassign them first.",
      );
    }

    // Check if any pending invitations reference this role
    const invitationWithRole = await ctx.db
      .query("invitations")
      .withIndex("by_org_roleId", (q) =>
        q.eq("orgId", orgId).eq("roleId", roleId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (invitationWithRole) {
      throw new Error(
        "Cannot delete a role that is referenced by pending invitations. Revoke them first.",
      );
    }

    await ctx.db.delete(roleId);

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "role.deleted",
      resourceType: "role",
      resourceId: roleId as string,
      metadata: { name: role.name },
    });
    return null;
  },
});

// ============================================================================
// MEMBERS
// ============================================================================

export const listMembers = query({
  args: {
    userId: v.string(),
    orgId: v.string(),
  },
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
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    await requirePermission(ctx, orgId, args.userId, "member:read");

    const members = await ctx.db
      .query("orgMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(500);

    const results = [];
    for (const m of members) {
      const role = await ctx.db.get(m.roleId);
      if (!role) continue;

      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", m.userId))
        .unique();

      results.push({
        _id: m._id as string,
        userId: m.userId,
        joinedAt: m.joinedAt,
        invitedBy: m.invitedBy,
        role: {
          _id: role._id as string,
          name: role.name,
          permissions: role.permissions,
          sortOrder: role.sortOrder,
        },
        profile: profile
          ? {
              displayName: profile.displayName,
              email: profile.email,
              avatarUrl: profile.avatarUrl,
            }
          : null,
      });
    }
    return results;
  },
});

export const getMembershipQuery = query({
  args: {
    userId: v.string(),
    orgId: v.string(),
  },
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
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    const membership = await getMembership(ctx, orgId, args.userId);
    if (!membership) return null;

    return {
      _id: membership._id as string,
      userId: membership.userId,
      joinedAt: membership.joinedAt,
      role: {
        _id: membership.role._id as string,
        name: membership.role.name,
        permissions: membership.role.permissions,
        sortOrder: membership.role.sortOrder,
      },
    };
  },
});

export const updateMemberRole = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
    targetUserId: v.string(),
    roleId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    const actorMembership = await requirePermission(
      ctx,
      orgId,
      args.userId,
      "member:manage",
    );

    const targetMembership = await requireMembership(
      ctx,
      orgId,
      args.targetUserId,
    );

    const newRoleId = args.roleId as Id<"orgRoles">;
    const newRole = await ctx.db.get(newRoleId);
    if (!newRole || newRole.orgId !== orgId) {
      throw new Error("Role not found");
    }

    // Can't manage someone with equal or higher authority
    if (!canManageRole(actorMembership.role, targetMembership.role)) {
      throw new Error("Cannot manage a member with equal or higher authority");
    }

    // Can't assign a role with higher authority than your own
    if (!canManageRole(actorMembership.role, newRole)) {
      throw new Error("Cannot assign a role with higher authority than your own");
    }

    const oldRole = targetMembership.role;
    await ctx.db.patch(targetMembership._id, { roleId: newRoleId });

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "member.role_changed",
      resourceType: "member",
      resourceId: targetMembership._id as string,
      metadata: {
        targetUserId: args.targetUserId,
        oldRole: oldRole.name,
        newRole: newRole.name,
      },
    });
    return null;
  },
});

export const removeMember = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
    targetUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    const actorMembership = await requirePermission(
      ctx,
      orgId,
      args.userId,
      "member:remove",
    );

    const targetMembership = await requireMembership(
      ctx,
      orgId,
      args.targetUserId,
    );

    // Can't remove someone with equal or higher authority
    if (!canManageRole(actorMembership.role, targetMembership.role)) {
      throw new Error("Cannot remove a member with equal or higher authority");
    }

    // Can't remove yourself via this endpoint (use leaveOrg instead)
    if (args.userId === args.targetUserId) {
      throw new Error("Use leaveOrg to remove yourself");
    }

    await ctx.db.delete(targetMembership._id);

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "member.removed",
      resourceType: "member",
      resourceId: targetMembership._id as string,
      metadata: { targetUserId: args.targetUserId },
    });
    return null;
  },
});

export const leaveOrg = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    const membership = await requireMembership(ctx, orgId, args.userId);

    // Can't leave if you're the last owner
    if (membership.role.name === "owner") {
      const owners = await ctx.db
        .query("orgMembers")
        .withIndex("by_org_role", (q) =>
          q.eq("orgId", orgId).eq("roleId", membership.roleId),
        )
        .collect();
      if (owners.length <= 1) {
        throw new Error(
          "Cannot leave: you are the last owner. Transfer ownership first.",
        );
      }
    }

    await ctx.db.delete(membership._id);

    // Clear active org if this was it
    const profile = await getProfile(ctx, args.userId);
    if (profile && profile.activeOrgId === orgId) {
      await ctx.db.patch(profile._id, { activeOrgId: undefined });
    }

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "member.left",
      resourceType: "member",
      resourceId: membership._id as string,
    });
    return null;
  },
});

// ============================================================================
// PERMISSIONS
// ============================================================================

export const checkPermissionQuery = query({
  args: {
    userId: v.string(),
    orgId: v.string(),
    permission: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    const membership = await getMembership(ctx, orgId, args.userId);
    if (!membership) return false;
    return hasPermission(membership.role.permissions, args.permission);
  },
});

// ============================================================================
// INVITATIONS
// ============================================================================

export const createInvitation = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    roleId: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    await requirePermission(ctx, orgId, args.userId, "member:invite");
    await requireOrg(ctx, orgId);

    if (!args.email && !args.phone) {
      throw new Error("Either email or phone is required");
    }

    const roleId = args.roleId as Id<"orgRoles">;
    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== orgId) {
      throw new Error("Role not found in this organization");
    }

    // Check if there's already a pending invitation for this email/phone in this org
    if (args.email) {
      const duplicate = await ctx.db
        .query("invitations")
        .withIndex("by_org_email_status", (q) =>
          q.eq("orgId", orgId).eq("email", args.email!).eq("status", "pending"),
        )
        .first();
      if (duplicate) {
        throw new Error("A pending invitation already exists for this email");
      }
    }

    if (args.phone) {
      const duplicate = await ctx.db
        .query("invitations")
        .withIndex("by_org_phone_status", (q) =>
          q.eq("orgId", orgId).eq("phone", args.phone!).eq("status", "pending"),
        )
        .first();
      if (duplicate) {
        throw new Error("A pending invitation already exists for this phone");
      }
    }

    const invitationId = await ctx.db.insert("invitations", {
      orgId,
      email: args.email,
      phone: args.phone,
      roleId,
      invitedBy: args.userId,
      status: "pending",
      token: args.tokenHash,
      expiresAt: args.expiresAt,
    });

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "invitation.created",
      resourceType: "invitation",
      resourceId: invitationId as string,
      metadata: { email: args.email, phone: args.phone, role: role.name },
    });

    return invitationId as string;
  },
});

export const listInvitations = query({
  args: {
    userId: v.string(),
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
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    await requirePermission(ctx, orgId, args.userId, "invitation:read");

    let invitations;
    if (args.status) {
      invitations = await ctx.db
        .query("invitations")
        .withIndex("by_org_status", (q) =>
          q
            .eq("orgId", orgId)
            .eq(
              "status",
              args.status as
                | "pending"
                | "accepted"
                | "declined"
                | "expired"
                | "revoked",
            ),
        )
        .take(500);
    } else {
      invitations = await ctx.db
        .query("invitations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .take(500);
    }

    const results = [];
    for (const inv of invitations) {
      const role = await ctx.db.get(inv.roleId);
      results.push({
        _id: inv._id as string,
        email: inv.email,
        phone: inv.phone,
        status: inv.status,
        invitedBy: inv.invitedBy,
        expiresAt: inv.expiresAt,
        acceptedBy: inv.acceptedBy,
        acceptedAt: inv.acceptedAt,
        role: role
          ? { _id: role._id as string, name: role.name }
          : { _id: "", name: "unknown" },
      });
    }
    return results;
  },
});

export const revokeInvitation = mutation({
  args: {
    userId: v.string(),
    invitationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitationId = args.invitationId as Id<"invitations">;
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    await requirePermission(
      ctx,
      invitation.orgId,
      args.userId,
      "invitation:manage",
    );

    if (invitation.status !== "pending") {
      throw new Error("Can only revoke pending invitations");
    }

    await ctx.db.patch(invitationId, { status: "revoked" });

    await writeAuditLog(ctx, {
      orgId: invitation.orgId,
      actorUserId: args.userId,
      action: "invitation.revoked",
      resourceType: "invitation",
      resourceId: invitationId as string,
    });
    return null;
  },
});

export const getInvitationByToken = query({
  args: { tokenHash: v.string() },
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
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.tokenHash))
      .first();
    if (!invitation) return null;

    const org = await ctx.db.get(invitation.orgId);
    if (!org) return null;

    const role = await ctx.db.get(invitation.roleId);

    return {
      _id: invitation._id as string,
      orgId: invitation.orgId as string,
      orgName: org.name,
      orgSlug: org.slug,
      email: invitation.email,
      phone: invitation.phone,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      roleName: role?.name ?? "unknown",
    };
  },
});

export const acceptInvitation = mutation({
  args: {
    userId: v.string(),
    tokenHash: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    memberId: v.string(),
  }),
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.tokenHash))
      .first();
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Invitation is ${invitation.status}`);
    }

    if (invitation.expiresAt < Date.now()) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      throw new Error("Invitation has expired");
    }

    // Verify the user's email/phone matches
    const profile = await getProfile(ctx, args.userId);
    if (invitation.email && profile?.email !== invitation.email) {
      throw new Error("Email does not match invitation");
    }
    if (invitation.phone && profile?.phone !== invitation.phone) {
      throw new Error("Phone does not match invitation");
    }

    // Validate the invited role still exists
    const role = await ctx.db.get(invitation.roleId);
    if (!role || role.orgId !== invitation.orgId) {
      throw new Error(
        "The role for this invitation no longer exists. Please request a new invitation.",
      );
    }

    // Check if already a member
    const existing = await getMembership(ctx, invitation.orgId, args.userId);
    if (existing) {
      throw new Error("Already a member of this organization");
    }

    // Add as member
    const memberId = await ctx.db.insert("orgMembers", {
      orgId: invitation.orgId,
      userId: args.userId,
      roleId: invitation.roleId,
      joinedAt: Date.now(),
      invitedBy: invitation.invitedBy,
    });

    // Update invitation
    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedBy: args.userId,
      acceptedAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      orgId: invitation.orgId,
      actorUserId: args.userId,
      action: "invitation.accepted",
      resourceType: "invitation",
      resourceId: invitation._id as string,
    });

    await writeAuditLog(ctx, {
      orgId: invitation.orgId,
      actorUserId: args.userId,
      action: "member.added",
      resourceType: "member",
      resourceId: memberId as string,
      metadata: { viaInvitation: invitation._id as string },
    });

    return {
      orgId: invitation.orgId as string,
      memberId: memberId as string,
    };
  },
});

export const declineInvitation = mutation({
  args: {
    userId: v.string(),
    tokenHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.tokenHash))
      .first();
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Invitation is ${invitation.status}`);
    }

    await ctx.db.patch(invitation._id, { status: "declined" });

    await writeAuditLog(ctx, {
      orgId: invitation.orgId,
      actorUserId: args.userId,
      action: "invitation.declined",
      resourceType: "invitation",
      resourceId: invitation._id as string,
    });
    return null;
  },
});

// ============================================================================
// INVITATION CODES
// ============================================================================

export const createInvitationCode = mutation({
  args: {
    userId: v.string(),
    orgId: v.string(),
    roleId: v.string(),
    maxRedemptions: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    _id: v.string(),
    code: v.string(),
  }),
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    await requirePermission(ctx, orgId, args.userId, "invitationCode:create");
    await requireOrg(ctx, orgId);

    const roleId = args.roleId as Id<"orgRoles">;
    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== orgId) {
      throw new Error("Role not found in this organization");
    }

    // Generate unique code with retry
    let code = "";
    let attempts = 0;
    do {
      code = generateInvitationCode();
      const existing = await ctx.db
        .query("invitationCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!existing) break;
      attempts++;
    } while (attempts < 5);
    if (attempts >= 5) {
      throw new Error("Failed to generate unique invitation code");
    }

    const id = await ctx.db.insert("invitationCodes", {
      orgId,
      code,
      roleId,
      createdBy: args.userId,
      maxRedemptions: args.maxRedemptions,
      redemptionCount: 0,
      expiresAt: args.expiresAt,
      status: "active",
    });

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.userId,
      action: "invitationCode.created",
      resourceType: "invitationCode",
      resourceId: id as string,
      metadata: { code, role: role.name, maxRedemptions: args.maxRedemptions },
    });

    return { _id: id as string, code };
  },
});

export const listInvitationCodes = query({
  args: {
    userId: v.string(),
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
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    await requirePermission(ctx, orgId, args.userId, "invitationCode:read");

    let codes;
    if (args.status) {
      codes = await ctx.db
        .query("invitationCodes")
        .withIndex("by_org_status", (q) =>
          q
            .eq("orgId", orgId)
            .eq("status", args.status as "active" | "revoked"),
        )
        .take(500);
    } else {
      codes = await ctx.db
        .query("invitationCodes")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .take(500);
    }

    const results = [];
    for (const ic of codes) {
      const role = await ctx.db.get(ic.roleId);
      results.push({
        _id: ic._id as string,
        code: ic.code,
        createdBy: ic.createdBy,
        maxRedemptions: ic.maxRedemptions,
        redemptionCount: ic.redemptionCount,
        expiresAt: ic.expiresAt,
        status: ic.status,
        role: role
          ? { _id: role._id as string, name: role.name }
          : { _id: "", name: "unknown" },
      });
    }
    return results;
  },
});

export const getInvitationCodeByCode = query({
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
  handler: async (ctx, args) => {
    const code = args.code.toUpperCase();
    const invitationCode = await ctx.db
      .query("invitationCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!invitationCode) return null;

    const org = await ctx.db.get(invitationCode.orgId);
    if (!org || org.status === "deleted") return null;

    const role = await ctx.db.get(invitationCode.roleId);

    return {
      _id: invitationCode._id as string,
      orgId: invitationCode.orgId as string,
      orgName: org.name,
      orgSlug: org.slug,
      status: invitationCode.status,
      roleName: role?.name ?? "unknown",
      maxRedemptions: invitationCode.maxRedemptions,
      redemptionCount: invitationCode.redemptionCount,
      expiresAt: invitationCode.expiresAt,
    };
  },
});

export const redeemInvitationCode = mutation({
  args: {
    userId: v.string(),
    code: v.string(),
  },
  returns: v.object({
    orgId: v.string(),
    memberId: v.string(),
  }),
  handler: async (ctx, args) => {
    const code = args.code.toUpperCase();
    const invitationCode = await ctx.db
      .query("invitationCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!invitationCode) {
      throw new Error("Invitation code not found");
    }

    if (invitationCode.status !== "active") {
      throw new Error("Invitation code has been revoked");
    }

    if (
      invitationCode.expiresAt !== undefined &&
      invitationCode.expiresAt < Date.now()
    ) {
      throw new Error("Invitation code has expired");
    }

    if (
      invitationCode.maxRedemptions !== undefined &&
      invitationCode.redemptionCount >= invitationCode.maxRedemptions
    ) {
      throw new Error("Invitation code has reached its maximum redemptions");
    }

    const org = await ctx.db.get(invitationCode.orgId);
    if (!org || org.status === "deleted") {
      throw new Error("Organization not found");
    }

    const role = await ctx.db.get(invitationCode.roleId);
    if (!role || role.orgId !== invitationCode.orgId) {
      throw new Error(
        "The role for this invitation code no longer exists. Please request a new code.",
      );
    }

    const existing = await getMembership(
      ctx,
      invitationCode.orgId,
      args.userId,
    );
    if (existing) {
      throw new Error("Already a member of this organization");
    }

    const memberId = await ctx.db.insert("orgMembers", {
      orgId: invitationCode.orgId,
      userId: args.userId,
      roleId: invitationCode.roleId,
      joinedAt: Date.now(),
      invitedBy: invitationCode.createdBy,
    });

    await ctx.db.patch(invitationCode._id, {
      redemptionCount: invitationCode.redemptionCount + 1,
    });

    await writeAuditLog(ctx, {
      orgId: invitationCode.orgId,
      actorUserId: args.userId,
      action: "invitationCode.redeemed",
      resourceType: "invitationCode",
      resourceId: invitationCode._id as string,
      metadata: { code: invitationCode.code },
    });

    await writeAuditLog(ctx, {
      orgId: invitationCode.orgId,
      actorUserId: args.userId,
      action: "member.added",
      resourceType: "member",
      resourceId: memberId as string,
      metadata: { viaInvitationCode: invitationCode._id as string },
    });

    return {
      orgId: invitationCode.orgId as string,
      memberId: memberId as string,
    };
  },
});

export const revokeInvitationCode = mutation({
  args: {
    userId: v.string(),
    invitationCodeId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitationCodeId = args.invitationCodeId as Id<"invitationCodes">;
    const invitationCode = await ctx.db.get(invitationCodeId);
    if (!invitationCode) {
      throw new Error("Invitation code not found");
    }

    await requirePermission(
      ctx,
      invitationCode.orgId,
      args.userId,
      "invitationCode:manage",
    );

    if (invitationCode.status !== "active") {
      throw new Error("Invitation code is already revoked");
    }

    await ctx.db.patch(invitationCodeId, {
      status: "revoked",
      revokedAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      orgId: invitationCode.orgId,
      actorUserId: args.userId,
      action: "invitationCode.revoked",
      resourceType: "invitationCode",
      resourceId: invitationCodeId as string,
    });
    return null;
  },
});

export const purgeRevokedInvitationCodes = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;

    const codes = await ctx.db
      .query("invitationCodes")
      .withIndex("by_status_revokedAt", (q) =>
        q.eq("status", "revoked").gt("revokedAt", 0).lte("revokedAt", cutoff),
      )
      .take(50);

    for (const code of codes) {
      await ctx.db.delete(code._id);
    }

    return codes.length;
  },
});

// ============================================================================
// DEVICES
// ============================================================================

export const registerDevice = mutation({
  args: {
    userId: v.string(),
    sessionId: v.string(),
    deviceName: v.optional(v.string()),
    deviceType: v.optional(
      v.union(
        v.literal("web"),
        v.literal("mobile"),
        v.literal("tablet"),
        v.literal("desktop"),
      ),
    ),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Upsert: update if sessionId already exists
    const existing = await ctx.db
      .query("userDevices")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastActiveAt: Date.now(),
        ...(args.deviceName !== undefined && { deviceName: args.deviceName }),
        ...(args.browser !== undefined && { browser: args.browser }),
        ...(args.os !== undefined && { os: args.os }),
        ...(args.ipAddress !== undefined && { ipAddress: args.ipAddress }),
      });
      return existing._id as string;
    }

    const now = Date.now();
    const deviceId = await ctx.db.insert("userDevices", {
      userId: args.userId,
      sessionId: args.sessionId,
      deviceName: args.deviceName,
      deviceType: args.deviceType,
      browser: args.browser,
      os: args.os,
      ipAddress: args.ipAddress,
      lastActiveAt: now,
      createdAt: now,
    });

    await writeAuditLog(ctx, {
      actorUserId: args.userId,
      action: "device.registered",
      resourceType: "device",
      resourceId: deviceId as string,
      metadata: { deviceName: args.deviceName, browser: args.browser },
    });

    return deviceId as string;
  },
});

export const listDevices = query({
  args: { userId: v.string() },
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
  handler: async (ctx, args) => {
    const devices = await ctx.db
      .query("userDevices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(100);

    return devices.map((d) => ({
      _id: d._id as string,
      sessionId: d.sessionId,
      deviceName: d.deviceName,
      deviceType: d.deviceType,
      browser: d.browser,
      os: d.os,
      ipAddress: d.ipAddress,
      lastActiveAt: d.lastActiveAt,
      createdAt: d.createdAt,
    }));
  },
});

export const updateDeviceActivity = mutation({
  args: {
    userId: v.string(),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("userDevices")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (device && device.userId === args.userId) {
      await ctx.db.patch(device._id, { lastActiveAt: Date.now() });
    }
    return null;
  },
});

export const removeDevice = mutation({
  args: {
    userId: v.string(),
    deviceId: v.string(),
  },
  returns: v.object({
    sessionId: v.string(),
  }),
  handler: async (ctx, args) => {
    const deviceId = args.deviceId as Id<"userDevices">;
    const device = await ctx.db.get(deviceId);
    if (!device || device.userId !== args.userId) {
      throw new Error("Device not found");
    }

    const sessionId = device.sessionId;
    await ctx.db.delete(deviceId);

    await writeAuditLog(ctx, {
      actorUserId: args.userId,
      action: "device.removed",
      resourceType: "device",
      resourceId: deviceId as string,
      metadata: { deviceName: device.deviceName, sessionId },
    });

    return { sessionId };
  },
});

export const removeAllOtherDevices = mutation({
  args: {
    userId: v.string(),
    currentSessionId: v.string(),
  },
  returns: v.object({
    sessionIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const devices = await ctx.db
      .query("userDevices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const sessionIds: string[] = [];
    for (const device of devices) {
      if (device.sessionId !== args.currentSessionId) {
        sessionIds.push(device.sessionId);
        await ctx.db.delete(device._id);
      }
    }

    await writeAuditLog(ctx, {
      actorUserId: args.userId,
      action: "device.revoked_all",
      resourceType: "device",
      metadata: { revokedCount: sessionIds.length },
    });

    return { sessionIds };
  },
});

// ============================================================================
// IMPERSONATION
// ============================================================================

export const startImpersonation = mutation({
  args: {
    actorUserId: v.string(),
    targetUserId: v.string(),
    reason: v.optional(v.string()),
    ttlMs: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);

    // Can't impersonate another admin
    const targetProfile = await requireProfile(ctx, args.targetUserId);
    if (targetProfile.isAdmin) {
      throw new Error("Cannot impersonate another admin");
    }

    // End any existing active impersonation
    const existing = await ctx.db
      .query("impersonationSessions")
      .withIndex("by_admin_active", (q) =>
        q.eq("adminUserId", args.actorUserId).eq("status", "active"),
      )
      .collect();
    for (const session of existing) {
      await ctx.db.patch(session._id, {
        status: "ended",
        endedAt: Date.now(),
      });
    }

    const now = Date.now();
    const sessionId = await ctx.db.insert("impersonationSessions", {
      adminUserId: args.actorUserId,
      targetUserId: args.targetUserId,
      reason: args.reason,
      startedAt: now,
      expiresAt: now + args.ttlMs,
      status: "active",
    });

    await writeAuditLog(ctx, {
      actorUserId: args.actorUserId,
      action: "impersonation.started",
      resourceType: "impersonation",
      resourceId: sessionId as string,
      metadata: {
        targetUserId: args.targetUserId,
        reason: args.reason,
      },
    });

    return sessionId as string;
  },
});

export const stopImpersonation = mutation({
  args: { actorUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("impersonationSessions")
      .withIndex("by_admin_active", (q) =>
        q.eq("adminUserId", args.actorUserId).eq("status", "active"),
      )
      .collect();

    for (const session of sessions) {
      await ctx.db.patch(session._id, {
        status: "ended",
        endedAt: Date.now(),
      });

      await writeAuditLog(ctx, {
        actorUserId: args.actorUserId,
        action: "impersonation.ended",
        resourceType: "impersonation",
        resourceId: session._id as string,
        metadata: { targetUserId: session.targetUserId },
      });
    }
    return null;
  },
});

export const getActiveImpersonation = query({
  args: { actorUserId: v.string() },
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
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("impersonationSessions")
      .withIndex("by_admin_active", (q) =>
        q.eq("adminUserId", args.actorUserId).eq("status", "active"),
      )
      .first();

    if (!session) return null;

    // Check expiry
    if (session.expiresAt < Date.now()) {
      return null;
    }

    return {
      _id: session._id as string,
      targetUserId: session.targetUserId,
      reason: session.reason,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
    };
  },
});

export const listImpersonationHistory = query({
  args: {
    actorUserId: v.string(),
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const limit = args.limit ?? 50;

    let sessions;
    if (args.targetUserId) {
      sessions = await ctx.db
        .query("impersonationSessions")
        .withIndex("by_target", (q) =>
          q.eq("targetUserId", args.targetUserId!),
        )
        .order("desc")
        .take(limit);
    } else {
      sessions = await ctx.db
        .query("impersonationSessions")
        .order("desc")
        .take(limit);
    }

    return sessions.map((s) => ({
      _id: s._id as string,
      adminUserId: s.adminUserId,
      targetUserId: s.targetUserId,
      reason: s.reason,
      startedAt: s.startedAt,
      expiresAt: s.expiresAt,
      endedAt: s.endedAt,
      status: s.status,
    }));
  },
});

// ============================================================================
// AUDIT LOGS
// ============================================================================

export const listAuditLogs = query({
  args: {
    userId: v.string(),
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
  handler: async (ctx, args) => {
    const orgId = args.orgId as Id<"organizations">;
    await requirePermission(ctx, orgId, args.userId, "audit:read");

    const limit = args.limit ?? 100;

    // Use the most specific composite index available
    let logs;
    if (args.action) {
      logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_org_and_action", (q) =>
          q.eq("orgId", orgId).eq("action", args.action!),
        )
        .order("desc")
        .take(limit);
    } else if (args.actorUserId) {
      logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_org_and_actor", (q) =>
          q.eq("orgId", orgId).eq("actorUserId", args.actorUserId!),
        )
        .order("desc")
        .take(limit);
    } else {
      logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(limit);
    }

    if (args.resourceType) {
      logs = logs.filter((l) => l.resourceType === args.resourceType);
    }

    return logs.map((l) => ({
      _id: l._id as string,
      actorUserId: l.actorUserId,
      effectiveUserId: l.effectiveUserId,
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      metadata: l.metadata,
      timestamp: l.timestamp,
    }));
  },
});

export const listPlatformAuditLogs = query({
  args: {
    actorUserId: v.string(),
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const limit = args.limit ?? 100;

    let logs;
    if (args.action) {
      logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_action", (q) => q.eq("action", args.action!))
        .order("desc")
        .take(limit);
    } else {
      logs = await ctx.db
        .query("auditLogs")
        .order("desc")
        .take(limit);
    }

    return logs.map((l) => ({
      _id: l._id as string,
      orgId: l.orgId as string | undefined,
      actorUserId: l.actorUserId,
      effectiveUserId: l.effectiveUserId,
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      metadata: l.metadata,
      timestamp: l.timestamp,
    }));
  },
});

// ============================================================================
// ADMIN
// ============================================================================

export const listAllProfiles = query({
  args: {
    actorUserId: v.string(),
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const limit = args.limit ?? 50;

    let profiles = await ctx.db.query("userProfiles").take(limit * 2);

    if (args.search) {
      const search = args.search.toLowerCase();
      profiles = profiles.filter(
        (p) =>
          p.email?.toLowerCase().includes(search) ||
          p.phone?.includes(search) ||
          p.displayName?.toLowerCase().includes(search) ||
          p.userId.toLowerCase().includes(search),
      );
    }

    return profiles.slice(0, limit).map((p) => ({
      _id: p._id as string,
      userId: p.userId,
      email: p.email,
      phone: p.phone,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      isBanned: p.isBanned,
      isAdmin: p.isAdmin,
      lastActiveAt: p.lastActiveAt,
      deletedAt: p.deletedAt,
    }));
  },
});

export const listAllOrgs = query({
  args: {
    actorUserId: v.string(),
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const limit = args.limit ?? 50;

    let orgs = await ctx.db.query("organizations").take(limit * 2);

    if (args.search) {
      const search = args.search.toLowerCase();
      orgs = orgs.filter(
        (o) =>
          o.name.toLowerCase().includes(search) ||
          o.slug.toLowerCase().includes(search),
      );
    }

    const results = [];
    for (const org of orgs.slice(0, limit)) {
      const members = await ctx.db
        .query("orgMembers")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();

      results.push({
        _id: org._id as string,
        name: org.name,
        slug: org.slug,
        status: org.status,
        createdBy: org.createdBy,
        isPersonal: org.isPersonal,
        memberCount: members.length,
      });
    }
    return results;
  },
});

export const getProfileDetail = query({
  args: {
    actorUserId: v.string(),
    targetUserId: v.string(),
  },
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);

    const profile = await getProfileIncludingDeleted(ctx, args.targetUserId);
    if (!profile) return null;

    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.targetUserId))
      .collect();

    const membershipDetails = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      const role = await ctx.db.get(m.roleId);
      if (org && role) {
        membershipDetails.push({
          orgId: org._id as string,
          orgName: org.name,
          orgSlug: org.slug,
          roleName: role.name,
          joinedAt: m.joinedAt,
        });
      }
    }

    const devices = await ctx.db
      .query("userDevices")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .collect();

    return {
      profile: {
        _id: profile._id as string,
        userId: profile.userId,
        email: profile.email,
        phone: profile.phone,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        metadata: profile.metadata,
        isBanned: profile.isBanned,
        banReason: profile.banReason,
        isAdmin: profile.isAdmin,
        lastActiveAt: profile.lastActiveAt,
        deletedAt: profile.deletedAt,
      },
      memberships: membershipDetails,
      devices: devices.map((d) => ({
        _id: d._id as string,
        deviceName: d.deviceName,
        browser: d.browser,
        os: d.os,
        lastActiveAt: d.lastActiveAt,
      })),
    };
  },
});

export const getOrgDetail = query({
  args: {
    actorUserId: v.string(),
    orgId: v.string(),
  },
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);

    const orgId = args.orgId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    if (!org) return null;

    const members = await ctx.db
      .query("orgMembers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const memberDetails = [];
    for (const m of members) {
      const profile = await getProfile(ctx, m.userId);
      const role = await ctx.db.get(m.roleId);
      memberDetails.push({
        userId: m.userId,
        displayName: profile?.displayName,
        email: profile?.email,
        roleName: role?.name ?? "unknown",
        joinedAt: m.joinedAt,
      });
    }

    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const pendingInvitations = await ctx.db
      .query("invitations")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", "pending"),
      )
      .collect();

    return {
      org: {
        _id: org._id as string,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        metadata: org.metadata,
        status: org.status,
        createdBy: org.createdBy,
      },
      members: memberDetails,
      roles: roles.map((r) => ({
        _id: r._id as string,
        name: r.name,
        permissions: r.permissions,
        isSystem: r.isSystem,
        sortOrder: r.sortOrder,
      })),
      pendingInvitations: pendingInvitations.length,
    };
  },
});

export const banUser = mutation({
  args: {
    actorUserId: v.string(),
    targetUserId: v.string(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const profile = await requireProfile(ctx, args.targetUserId);

    await ctx.db.patch(profile._id, {
      isBanned: true,
      banReason: args.reason,
      bannedAt: Date.now(),
    });

    await writeAuditLog(ctx, {
      actorUserId: args.actorUserId,
      action: "profile.banned",
      resourceType: "profile",
      resourceId: profile._id as string,
      metadata: { targetUserId: args.targetUserId, reason: args.reason },
    });
    return null;
  },
});

export const unbanUser = mutation({
  args: {
    actorUserId: v.string(),
    targetUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const profile = await requireProfile(ctx, args.targetUserId);

    await ctx.db.patch(profile._id, {
      isBanned: false,
      banReason: undefined,
      bannedAt: undefined,
    });

    await writeAuditLog(ctx, {
      actorUserId: args.actorUserId,
      action: "profile.unbanned",
      resourceType: "profile",
      resourceId: profile._id as string,
      metadata: { targetUserId: args.targetUserId },
    });
    return null;
  },
});

export const setAdmin = mutation({
  args: {
    actorUserId: v.string(),
    targetUserId: v.string(),
    isAdmin: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);

    if (args.actorUserId === args.targetUserId && !args.isAdmin) {
      throw new Error("Cannot remove your own admin status");
    }

    const profile = await requireProfile(ctx, args.targetUserId);
    await ctx.db.patch(profile._id, { isAdmin: args.isAdmin });

    await writeAuditLog(ctx, {
      actorUserId: args.actorUserId,
      action: args.isAdmin ? "admin.granted" : "admin.revoked",
      resourceType: "profile",
      resourceId: profile._id as string,
      metadata: { targetUserId: args.targetUserId },
    });
    return null;
  },
});

export const forceRemoveMember = mutation({
  args: {
    actorUserId: v.string(),
    orgId: v.string(),
    targetUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const orgId = args.orgId as Id<"organizations">;

    const membership = await getMembership(ctx, orgId, args.targetUserId);
    if (!membership) {
      throw new Error("User is not a member of this organization");
    }

    await ctx.db.delete(membership._id);

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.actorUserId,
      action: "member.removed",
      resourceType: "member",
      resourceId: membership._id as string,
      metadata: {
        targetUserId: args.targetUserId,
        forcedByAdmin: true,
      },
    });
    return null;
  },
});

export const transferOwnership = mutation({
  args: {
    actorUserId: v.string(),
    orgId: v.string(),
    newOwnerUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const orgId = args.orgId as Id<"organizations">;

    // Get the current owner
    const ownerRole = await getRoleByName(ctx, orgId, "owner");
    if (!ownerRole) {
      throw new Error("Owner role not found");
    }

    const adminRole = await getRoleByName(ctx, orgId, "admin");
    if (!adminRole) {
      throw new Error("Admin role not found");
    }

    // Find current owner membership
    const currentOwners = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_role", (q) =>
        q.eq("orgId", orgId).eq("roleId", ownerRole._id),
      )
      .collect();

    // Demote current owners to admin
    for (const owner of currentOwners) {
      await ctx.db.patch(owner._id, { roleId: adminRole._id });
    }

    // Promote new owner
    const newOwnerMembership = await getMembership(
      ctx,
      orgId,
      args.newOwnerUserId,
    );
    if (!newOwnerMembership) {
      throw new Error("New owner is not a member of this organization");
    }
    await ctx.db.patch(newOwnerMembership._id, { roleId: ownerRole._id });

    await writeAuditLog(ctx, {
      orgId,
      actorUserId: args.actorUserId,
      action: "org.ownership_transferred",
      resourceType: "organization",
      resourceId: orgId as string,
      metadata: {
        newOwnerUserId: args.newOwnerUserId,
        previousOwners: currentOwners.map((o) => o.userId),
      },
    });
    return null;
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

export const listMembersByOrgInternal = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.object({ userId: v.string() })),
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("orgMembers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(1000);
    return members.map((m) => ({ userId: m.userId }));
  },
});

// ============================================================================
// SCHEDULED TASKS (crons)
// ============================================================================

export const expireImpersonationSessions = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const active = await ctx.db
      .query("impersonationSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const now = Date.now();
    let expired = 0;
    for (const session of active) {
      if (session.expiresAt < now) {
        await ctx.db.patch(session._id, { status: "expired" });
        expired++;
      }
    }
    return expired;
  },
});

export const purgeDeletedUsers = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;

    // Find soft-deleted profiles past retention period (batch of 50)
    // Index sorts undefined first, then numbers ascending.
    // gt(0) skips all undefined values; lte(cutoff) bounds the range.
    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_deletedAt", (q) =>
        q.gt("deletedAt", 0).lte("deletedAt", cutoff),
      )
      .take(50);

    for (const profile of profiles) {
      // Clean up any remaining data (memberships/devices already removed at soft-delete time)
      const memberships = await ctx.db
        .query("orgMembers")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .collect();
      for (const m of memberships) {
        await ctx.db.delete(m._id);
      }

      const devices = await ctx.db
        .query("userDevices")
        .withIndex("by_userId", (q) => q.eq("userId", profile.userId))
        .collect();
      for (const d of devices) {
        await ctx.db.delete(d._id);
      }

      await ctx.db.delete(profile._id);
    }

    return profiles.length;
  },
});

export const purgeDeletedOrgs = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;

    // Find soft-deleted orgs past retention period (batch of 50)
    // Composite index on [status, deletedAt] avoids post-filter.
    // gt(0) skips orgs without deletedAt; lte(cutoff) bounds the range.
    const orgs = await ctx.db
      .query("organizations")
      .withIndex("by_status_and_deletedAt", (q) =>
        q.eq("status", "deleted").gt("deletedAt", 0).lte("deletedAt", cutoff),
      )
      .take(50);

    for (const org of orgs) {
      // Delete all roles
      const roles = await ctx.db
        .query("orgRoles")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();
      for (const role of roles) {
        await ctx.db.delete(role._id);
      }

      // Delete all remaining memberships
      const members = await ctx.db
        .query("orgMembers")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();
      for (const m of members) {
        await ctx.db.delete(m._id);
      }

      // Delete all invitations
      const invitations = await ctx.db
        .query("invitations")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();
      for (const inv of invitations) {
        await ctx.db.delete(inv._id);
      }

      // Delete all invitation codes
      const invitationCodes = await ctx.db
        .query("invitationCodes")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();
      for (const ic of invitationCodes) {
        await ctx.db.delete(ic._id);
      }

      // Delete audit logs for this org
      const auditLogs = await ctx.db
        .query("auditLogs")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();
      for (const log of auditLogs) {
        await ctx.db.delete(log._id);
      }

      await ctx.db.delete(org._id);
    }

    return orgs.length;
  },
});
