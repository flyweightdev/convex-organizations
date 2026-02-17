import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logoUrl: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdBy: v.string(),
    isPersonal: v.optional(v.boolean()),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("deleted"),
    ),
    deletedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_createdBy", ["createdBy"])
    .index("by_status", ["status"])
    .index("by_status_and_deletedAt", ["status", "deletedAt"]),

  orgRoles: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    isSystem: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_name", ["orgId", "name"]),

  orgMembers: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    roleId: v.id("orgRoles"),
    joinedAt: v.number(),
    invitedBy: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_role", ["orgId", "roleId"]),

  invitations: defineTable({
    orgId: v.id("organizations"),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    roleId: v.id("orgRoles"),
    invitedBy: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
      v.literal("revoked"),
    ),
    token: v.string(),
    expiresAt: v.number(),
    acceptedBy: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_token", ["token"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_email_status", ["orgId", "email", "status"])
    .index("by_org_phone_status", ["orgId", "phone", "status"])
    .index("by_org_roleId", ["orgId", "roleId"]),

  userProfiles: defineTable({
    userId: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    activeOrgId: v.optional(v.id("organizations")),
    lastActiveAt: v.optional(v.number()),
    isBanned: v.boolean(),
    banReason: v.optional(v.string()),
    bannedAt: v.optional(v.number()),
    isAdmin: v.boolean(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_deletedAt", ["deletedAt"]),

  userDevices: defineTable({
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
    lastActiveAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),

  impersonationSessions: defineTable({
    adminUserId: v.string(),
    targetUserId: v.string(),
    reason: v.optional(v.string()),
    startedAt: v.number(),
    expiresAt: v.number(),
    endedAt: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("ended"),
    ),
  })
    .index("by_admin_active", ["adminUserId", "status"])
    .index("by_target", ["targetUserId"])
    .index("by_status", ["status"]),

  auditLogs: defineTable({
    orgId: v.optional(v.id("organizations")),
    actorUserId: v.string(),
    effectiveUserId: v.optional(v.string()),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    ipAddress: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_org", ["orgId", "timestamp"])
    .index("by_actor", ["actorUserId", "timestamp"])
    .index("by_resource", ["resourceType", "resourceId"])
    .index("by_action", ["action", "timestamp"])
    .index("by_org_and_action", ["orgId", "action", "timestamp"])
    .index("by_org_and_actor", ["orgId", "actorUserId", "timestamp"]),
});
