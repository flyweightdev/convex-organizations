import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import type { Id, Doc } from "./_generated/dataModel.js";

// --- Permission checking ---

export function hasPermission(
  permissions: string[],
  required: string,
): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(required);
}

export async function getProfile(
  ctx: QueryCtx,
  userId: string,
): Promise<Doc<"userProfiles"> | null> {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (profile?.deletedAt) return null;
  return profile;
}

export async function getProfileIncludingDeleted(
  ctx: QueryCtx,
  userId: string,
): Promise<Doc<"userProfiles"> | null> {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireProfile(
  ctx: QueryCtx,
  userId: string,
): Promise<Doc<"userProfiles">> {
  const profile = await getProfile(ctx, userId);
  if (!profile) {
    throw new Error("User profile not found");
  }
  return profile;
}

export async function getMembership(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  userId: string,
): Promise<(Doc<"orgMembers"> & { role: Doc<"orgRoles"> }) | null> {
  const member = await ctx.db
    .query("orgMembers")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
  if (!member) return null;
  const role = await ctx.db.get(member.roleId);
  if (!role) return null;
  return { ...member, role };
}

export async function requireMembership(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  userId: string,
): Promise<Doc<"orgMembers"> & { role: Doc<"orgRoles"> }> {
  const membership = await getMembership(ctx, orgId, userId);
  if (!membership) {
    throw new Error("Not a member of this organization");
  }
  return membership;
}

export async function requirePermission(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  userId: string,
  permission: string,
): Promise<Doc<"orgMembers"> & { role: Doc<"orgRoles"> }> {
  const membership = await requireMembership(ctx, orgId, userId);
  if (!hasPermission(membership.role.permissions, permission)) {
    throw new Error(`Permission denied: requires ${permission}`);
  }
  return membership;
}

export function canManageRole(
  actorRole: Doc<"orgRoles">,
  targetRole: Doc<"orgRoles">,
): boolean {
  return actorRole.sortOrder < targetRole.sortOrder;
}

export async function requireAdmin(
  ctx: QueryCtx,
  actorUserId: string,
): Promise<Doc<"userProfiles">> {
  const profile = await requireProfile(ctx, actorUserId);
  if (!profile.isAdmin) {
    throw new Error("Platform admin access required");
  }
  return profile;
}

// --- Audit logging ---

export async function writeAuditLog(
  ctx: MutationCtx,
  params: {
    orgId?: Id<"organizations">;
    actorUserId: string;
    effectiveUserId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    orgId: params.orgId,
    actorUserId: params.actorUserId,
    effectiveUserId: params.effectiveUserId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: params.metadata,
    ipAddress: params.ipAddress,
    timestamp: Date.now(),
  });
}

// --- Organization helpers ---

export async function requireOrg(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
): Promise<Doc<"organizations">> {
  const org = await ctx.db.get(orgId);
  if (!org || org.status === "deleted") {
    throw new Error("Organization not found");
  }
  return org;
}

export async function getOrgRoles(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
): Promise<Doc<"orgRoles">[]> {
  return await ctx.db
    .query("orgRoles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
}

export async function getRoleByName(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  name: string,
): Promise<Doc<"orgRoles"> | null> {
  return await ctx.db
    .query("orgRoles")
    .withIndex("by_org_name", (q) => q.eq("orgId", orgId).eq("name", name))
    .unique();
}
