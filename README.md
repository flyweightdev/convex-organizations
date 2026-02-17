# @flyweightdev/convex-organizations

A Convex component for organizations, role-based access control, invitations, user profiles, device management, audit logging, and admin impersonation.

Built on top of [Convex Auth](https://labs.convex.dev/auth). Works with Next.js, React, and Expo/React Native.

This project was created with the help of Claude Code (Opus 4.6) and reviewed by GPT-5.3-Codex, CodeRabbitAI and humans.

## Why This Exists

Services like Clerk charge $80+/month just to unlock more than two organization roles. Better Auth requires polyfills, version-pinned dependencies, CLI-generated schemas, and unsupported plugins to get organizations working on Convex.

We wanted something simpler. Convex already has native auth with OTP, OAuth, passwords, and first-class Expo support. What it doesn't have is organizations, roles, invitations, and admin tooling. So we built that as a standalone Convex component you can pull into any app.

The result: install one package, register the component, export a few functions, and you have a full user/org management system with unlimited custom roles, audit logging, and admin impersonation — no external auth service required.

## Features

- **Organizations** — Create, update, soft-delete orgs with slugs, logos, and metadata
- **Role-Based Access Control** — Per-org roles defined in a table with granular `resource:action` permissions. System roles seeded from config, custom roles created at runtime. Role hierarchy enforcement (can't promote above yourself)
- **Members** — Invite, list, update roles, remove. Role hierarchy checks on every operation
- **Invitations** — Email or phone invitations with cryptographic tokens, expiry, accept/decline flow. Auto-accept on signup
- **User Profiles** — Synced from auth on login. Display name, avatar, metadata, active org tracking
- **Device Management** — Track sessions with parsed user-agent info. Users can view and revoke their own devices
- **Audit Logging** — Every mutation produces an audit entry with actor, effective user (for impersonation), resource, and metadata
- **Admin Impersonation** — Actor/effective-user model. Admin stays authenticated as themselves, sees what the target user sees. No device pollution on the target. Full audit trail
- **Admin Dashboard Support** — List all users/orgs, ban/unban, set platform admins, force-remove members, transfer ownership
- **Auth Providers** — Pre-built Resend (email OTP, magic links) and Twilio (SMS OTP, Twilio Verify) providers
- **React Hooks** — Headless hooks for profiles, orgs, members, roles, invitations, devices, audit logs, and impersonation
- **Expo / React Native** — Same backend, same hooks, no extra packages

## Prerequisites

You need a [Convex](https://convex.dev) project and at least one of these for OTP delivery:

| Service                                    | What For                                                 | Env Variable(s)                                                        |
| ------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Resend](https://resend.com)               | Email OTP, magic links                                   | `RESEND_API_KEY`                                                       |
| [Twilio](https://twilio.com)               | SMS OTP (you generate code)                              | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`        |
| [Twilio Verify](https://twilio.com/verify) | SMS OTP (Twilio generates + validates code, recommended) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |

Set these as server-side environment variables in the [Convex Dashboard](https://dashboard.convex.dev) under Settings > Environment Variables.

Your frontend only needs the Convex deployment URL:

```bash
# Next.js
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Expo
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

## Quick Start

### 1. Install the Component

```bash
npm install @flyweightdev/convex-organizations @convex-dev/auth
```

### 2. Add to Your Convex App

Create or update `convex/convex.config.ts`:

```typescript
import { defineApp } from "convex/server";
import userOrg from "@flyweightdev/convex-organizations/convex.config.js";

const app = defineApp();
app.use(userOrg);

export default app;
```

### 3. Configure Auth with Providers

Create `convex/auth.ts`:

```typescript
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP, TwilioOTP } from "@flyweightdev/convex-organizations/providers";
import { createAuthCallbacks } from "@flyweightdev/convex-organizations";
import { components } from "./_generated/api";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOTP({ appName: "MyApp", fromEmail: "noreply@yourdomain.com" }), TwilioOTP({ appName: "MyApp" })],
  callbacks: createAuthCallbacks(components.userOrg, {
    parseDeviceInfo: true,
  }),
});
```

The callbacks automatically sync user profiles, register devices on login, and auto-accept pending invitations when a user signs up.

### 4. Export the User/Org API

Create `convex/userOrg.ts`:

```typescript
import { createUserOrgAPI } from "@flyweightdev/convex-organizations";
import { components } from "./_generated/api";

export const { getMyProfile, updateMyProfile, setActiveOrg, createOrg, getOrg, getOrgBySlug, updateOrg, deleteOrg, listMyOrgs, listRoles, createRole, updateRole, deleteRole, listMembers, getMyMembership, updateMemberRole, removeMember, leaveOrg, createInvitation, listInvitations, revokeInvitation, getInvitationByToken, acceptInvitation, declineInvitation, listMyDevices, removeDevice, removeAllOtherDevices, checkPermission, listAuditLogs } = createUserOrgAPI(components.userOrg, {
  roles: [
    { name: "owner", permissions: ["*"], sortOrder: 0, isSystem: true },
    { name: "admin", permissions: ["org:read", "org:write", "member:read", "member:invite", "member:manage", "member:remove", "role:read", "role:manage", "invitation:read", "invitation:manage", "audit:read"], sortOrder: 10, isSystem: true },
    { name: "member", permissions: ["org:read", "member:read", "role:read", "invitation:read"], sortOrder: 20, isSystem: true },
    { name: "viewer", permissions: ["org:read"], sortOrder: 30, isSystem: true },
  ],
  createPersonalOrg: false,
  invitationExpiryMs: 7 * 24 * 60 * 60 * 1000,
  impersonationTtlMs: 60 * 60 * 1000,
});
```

### 5. Export the Admin API

Create `convex/admin.ts`:

```typescript
import { createAdminAPI } from "@flyweightdev/convex-organizations/admin";
import { components } from "./_generated/api";

export const { listAllUsers, getUserDetail, banUser, unbanUser, setAdmin, deleteUser, listAllOrgs, getOrgDetail, forceRemoveMember, transferOwnership, startImpersonation, stopImpersonation, getActiveImpersonation, listImpersonationHistory, listPlatformAuditLogs } = createAdminAPI(components.userOrg);
```

### 6. Set Up HTTP Routes

Create or update `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
```

### 7. Set Up the Schema

Create or update `convex/schema.ts`:

```typescript
import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  // Add your own app tables here
});
```

### 8. Add the React Provider

```tsx
"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { UserOrgProvider } from "@flyweightdev/convex-organizations/react";
import { api } from "../convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <UserOrgProvider
        api={api.userOrg}
        adminApi={api.admin}>
        {children}
      </UserOrgProvider>
    </ConvexAuthProvider>
  );
}
```

### 9. Start Using It

```typescript
import { useUser, useActiveOrganization, useOrganizationList } from "@flyweightdev/convex-organizations/react";

function Dashboard() {
  const { profile } = useUser();
  const { organization, role, hasPermission } = useActiveOrganization();
  const { organizations, setActive } = useOrganizationList();

  if (!profile) return <SignIn />;

  return (
    <div>
      <p>Welcome, {profile.displayName}</p>
      {organization && <p>Current org: {organization.name} ({role?.name})</p>}
      {hasPermission("member:invite") && <InviteButton />}
    </div>
  );
}
```

## Auth Providers

The package exports pre-built auth provider factories for use with `@convex-dev/auth`.

### Email OTP (Resend)

Sends a numeric verification code via Resend. Convex Auth generates and validates the code.

```typescript
import { ResendOTP } from "@flyweightdev/convex-organizations/providers";

ResendOTP({ appName: "MyApp", fromEmail: "noreply@yourdomain.com" });
```

Requires: `RESEND_API_KEY`

### Email Magic Link (Resend)

Sends a sign-in link via Resend.

```typescript
import { ResendMagicLink } from "@flyweightdev/convex-organizations/providers";

ResendMagicLink({ appName: "MyApp", fromEmail: "noreply@yourdomain.com" });
```

Requires: `RESEND_API_KEY`

### Phone OTP (Twilio)

Sends an OTP via Twilio SMS. Convex Auth generates the code, Twilio delivers it.

```typescript
import { TwilioOTP } from "@flyweightdev/convex-organizations/providers";

TwilioOTP({ appName: "MyApp" });
```

Requires: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`


## Roles and Permissions

Roles are stored **per organization** in the `orgRoles` table. When an org is created, system roles are seeded from your config. Org admins can create additional custom roles at runtime.

### Permission Strings

Permissions follow a `resource:action` convention:

| Permission          | Description                           |
| ------------------- | ------------------------------------- |
| `org:read`          | View org details                      |
| `org:write`         | Update org name, slug, logo, metadata |
| `org:delete`        | Delete the organization               |
| `member:read`       | View member list                      |
| `member:invite`     | Send invitations                      |
| `member:manage`     | Change member roles                   |
| `member:remove`     | Remove members                        |
| `role:read`         | View available roles                  |
| `role:manage`       | Create, update, delete custom roles   |
| `invitation:read`   | View pending invitations              |
| `invitation:manage` | Revoke invitations                    |
| `audit:read`        | View audit logs                       |

The wildcard `"*"` grants all permissions (used by the owner role).

### Role Hierarchy

Each role has a `sortOrder`. Lower values mean higher authority. A member can only assign or modify roles with a `sortOrder` greater than or equal to their own — you can't promote someone above yourself. The owner role has `sortOrder: 0`.

### Custom Roles

Define system roles in your config (seeded on org creation, cannot be deleted by users). Org admins with `role:manage` permission can create additional non-system roles at runtime:

```typescript
const createRole = useCreateRole();

await createRole({
  orgId,
  name: "billing-admin",
  description: "Can manage billing settings",
  permissions: ["org:read", "billing:read", "billing:manage"],
  sortOrder: 15,
});
```

## Invitations

Invite users by email or phone number. The component generates a cryptographic token (stored hashed), returns it once, and tracks invitation status.

```typescript
const createInvitation = useCreateInvitation();

// Invite by email
const { token } = await createInvitation({
  orgId,
  email: "alice@example.com",
  roleId: memberRoleId,
});

// Invite by phone
const { token } = await createInvitation({
  orgId,
  phone: "+14155551234",
  roleId: memberRoleId,
});
```

When a user signs up with a matching email or phone, the auth callbacks automatically accept pending invitations for that user.

Invitations have a configurable expiry (default 7 days) and can be revoked by org admins.

## Device Management

Devices are automatically registered when users sign in. The component parses the user-agent string to extract browser, OS, and device type.

```typescript
const { devices, currentDevice } = useDevices();
const removeDevice = useRemoveDevice();
const removeAllOtherDevices = useRemoveAllOtherDevices();

// Show all devices
devices.map(device => (
  <div key={device._id}>
    {device.deviceName} — {device.browser} on {device.os}
    {device._id !== currentDevice?._id && (
      <button onClick={() => removeDevice({ deviceId: device._id })}>
        Revoke
      </button>
    )}
  </div>
));

// Revoke all other sessions
await removeAllOtherDevices();
```

When a device is removed, the mutation returns the `sessionId` (or `sessionIds` for bulk removal). **Your app must invalidate the corresponding auth session(s) on the host side** using your auth provider's API. The component tracks devices but cannot directly invalidate auth tokens.

```typescript
const removeDevice = useRemoveDevice();
const { sessionId } = await removeDevice({ deviceId });
// Invalidate sessionId with your auth provider

const removeAll = useRemoveAllOtherDevices();
const { sessionIds } = await removeAll({ currentSessionId });
// Invalidate each sessionId with your auth provider
```

## Audit Logging

Every mutation in the component writes an audit log entry. Entries include:

- `actorUserId` — who performed the action
- `effectiveUserId` — the impersonated user (if applicable)
- `action` — what happened (`org.created`, `member.role_changed`, `invitation.accepted`, etc.)
- `resourceType` and `resourceId` — what was affected
- `metadata` — action-specific payload (old/new values, etc.)
- `timestamp`

Query audit logs with the `audit:read` permission:

```typescript
const { logs, loadMore } = useAuditLogs(orgId, {
  action: "member.*",
  limit: 50,
});
```

Platform admins can query cross-org audit logs via `listPlatformAuditLogs`.

### Audit Actions

| Action                  | Description                   |
| ----------------------- | ----------------------------- |
| `org.created`           | Organization created          |
| `org.updated`           | Organization settings changed |
| `org.deleted`           | Organization soft-deleted     |
| `member.added`          | Member joined the org         |
| `member.removed`        | Member removed from org       |
| `member.role_changed`   | Member's role updated         |
| `member.left`           | Member left the org           |
| `invitation.created`    | Invitation sent               |
| `invitation.accepted`   | Invitation accepted           |
| `invitation.declined`   | Invitation declined           |
| `invitation.revoked`    | Invitation revoked            |
| `role.created`          | Custom role created           |
| `role.updated`          | Role permissions changed      |
| `role.deleted`          | Custom role deleted           |
| `device.registered`     | New device registered         |
| `device.removed`        | Device revoked                |
| `device.revoked_all`    | All other devices revoked     |
| `profile.updated`       | User profile updated          |
| `profile.banned`        | User banned                   |
| `profile.unbanned`      | User unbanned                 |
| `impersonation.started` | Admin started impersonating   |
| `impersonation.ended`   | Admin stopped impersonating   |

## Data Retention & Soft Deletion

Both users and organizations are **soft-deleted** — they are marked for deletion but retained for a 7-day grace period before permanent removal. This allows admins to inspect recently deleted accounts and provides a window for recovery if needed.

### How It Works

**Users** — When a user is deleted (via `deleteUser` or the admin API):

- The profile is marked with a `deletedAt` timestamp
- Memberships and devices are removed immediately (they affect active org operations)
- The profile record remains in the database for 7 days
- During this period, the user cannot log in or be looked up via normal queries
- Admin queries (`listAllUsers`, `getUserDetail`) still show the deleted user with its `deletedAt` timestamp

**Organizations** — When an org is deleted (via `deleteOrg`):

- The org status is set to `"deleted"` and `deletedAt` is recorded
- Members, roles, and invitations remain in the database for 7 days
- The org no longer appears in member-facing queries
- Admin queries continue to show the deleted org

### Automatic Purge

A daily cron job permanently removes data past the retention period:

| Cron                            | Schedule           | What It Purges                                                                       |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| `purge deleted users`           | Daily at 03:00 UTC | User profiles where `deletedAt` is older than 7 days                                 |
| `purge deleted orgs`            | Daily at 03:30 UTC | Deleted orgs (+ their roles, memberships, invitations, audit logs) older than 7 days |
| `expire impersonation sessions` | Hourly             | Active impersonation sessions past their TTL                                         |

### What Gets Purged

When a **user** is purged: the profile record is permanently deleted.

When an **org** is purged: the organization record, all its roles, remaining memberships, invitations, and associated audit logs are permanently deleted.

## Admin and Impersonation

### Admin Functions

Users with `isAdmin: true` on their profile can access platform-level admin functions:

```typescript
import { createAdminAPI } from "@flyweightdev/convex-organizations/admin";

// List all users (paginated, searchable)
const users = await listAllUsers({ cursor, limit: 50, search: "alice" });

// Get full user detail (profile + orgs + devices)
const detail = await getUserDetail({ targetUserId });

// Ban/unban users
await banUser({ targetUserId, reason: "Violation of terms" });
await unbanUser({ targetUserId });

// Force-remove a member (bypasses role hierarchy)
await forceRemoveMember({ orgId, targetUserId });

// Transfer org ownership
await transferOwnership({ orgId, newOwnerUserId });
```

### Impersonation

The impersonation model uses an **actor/effective-user** approach. The admin stays authenticated as themselves — no session swapping, no token juggling:

```typescript
const { isImpersonating, targetUser, startImpersonation, stopImpersonation } = useImpersonation();

// Start impersonating
await startImpersonation(targetUserId, "Debugging user's billing issue");

// Now all hooks (useUser, useActiveOrganization, useDevices, etc.)
// automatically resolve data for the target user.

// Stop impersonating
await stopImpersonation();
```

How it works:

1. Admin calls `startImpersonation` — creates a time-limited impersonation session (default 1 hour)
2. On every subsequent request, the wrapper factory resolves the `effectiveUserId` from the active impersonation session
3. Queries return the target user's data. Mutations execute as the target user but the audit log records both `actorUserId` (admin) and `effectiveUserId` (target)
4. **Device registration is skipped** during impersonation — the admin's device never appears in the target user's device list
5. An admin cannot impersonate another admin

## Expo / React Native

The component works with Expo out of the box. Same backend, same hooks, no extra packages beyond `expo-secure-store`.

```tsx
// app/_layout.tsx
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { UserOrgProvider } from "@flyweightdev/convex-organizations/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api } from "../convex/_generated/api";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export default function RootLayout() {
  return (
    <ConvexAuthProvider
      client={convex}
      storage={Platform.OS !== "web" ? secureStorage : undefined}>
      <UserOrgProvider api={api.userOrg}>
        <Slot />
      </UserOrgProvider>
    </ConvexAuthProvider>
  );
}
```

Phone OTP sign-in is identical on web and mobile — two-step flow (enter phone, then enter code) using `useAuthActions().signIn("twilio-verify", formData)`.

## React Hooks

All hooks are headless (no UI components) and work on both web and React Native.

| Hook                            | Returns                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `useUser()`                     | `{ profile, isLoading }`                                                               |
| `useUpdateProfile()`            | Mutation to update display name, avatar, metadata                                      |
| `useOrganizationList()`         | `{ organizations, isLoading }` + `setActive`, `create`                                 |
| `useActiveOrganization()`       | `{ organization, membership, role, hasPermission, setActive, isLoading }`              |
| `useMembers(orgId)`             | `{ members, isLoading }`                                                               |
| `useUpdateMemberRole()`         | Mutation to change a member's role                                                     |
| `useRemoveMember()`             | Mutation to remove a member                                                            |
| `useLeaveOrg()`                 | Mutation to leave an org                                                               |
| `useRoles(orgId)`               | `{ roles, isLoading }`                                                                 |
| `useCreateRole()`               | Mutation to create a custom role                                                       |
| `useUpdateRole()`               | Mutation to update a role's permissions                                                |
| `useDeleteRole()`               | Mutation to delete a custom role                                                       |
| `useInvitations(orgId)`         | `{ invitations, isLoading }`                                                           |
| `useCreateInvitation()`         | Mutation to send an invitation                                                         |
| `useRevokeInvitation()`         | Mutation to revoke an invitation                                                       |
| `useAcceptInvitation()`         | Mutation to accept an invitation                                                       |
| `useDeclineInvitation()`        | Mutation to decline an invitation                                                      |
| `useDevices()`                  | `{ devices, currentDevice, isLoading }`                                                |
| `useRemoveDevice()`             | Mutation to revoke a device (returns `sessionId` for host-side invalidation)           |
| `useRemoveAllOtherDevices()`    | Mutation to revoke all other devices (returns `sessionIds` for host-side invalidation) |
| `useAuditLogs(orgId, filters?)` | `{ logs, isLoading, loadMore }`                                                        |
| `useImpersonation()`            | `{ isImpersonating, targetUser, startImpersonation, stopImpersonation }`               |

## Database Schema

The component creates these tables in its own isolated namespace (separate from your app's tables):

### organizations

| Field        | Type     | Description                                       |
| ------------ | -------- | ------------------------------------------------- |
| `name`       | string   | Display name                                      |
| `slug`       | string   | URL-safe unique identifier                        |
| `logoUrl`    | string?  | Logo URL                                          |
| `metadata`   | any?     | App-specific JSON                                 |
| `createdBy`  | string   | userId of creator                                 |
| `isPersonal` | boolean? | Auto-created 1:1 org per user                     |
| `status`     | string   | `"active"`, `"suspended"`, or `"deleted"`         |
| `deletedAt`  | number?  | Timestamp when soft-deleted (for retention purge) |

### orgRoles

| Field         | Type     | Description                   |
| ------------- | -------- | ----------------------------- |
| `orgId`       | id       | Organization reference        |
| `name`        | string   | Role name                     |
| `description` | string?  | Human-readable description    |
| `permissions` | string[] | Permission strings            |
| `isSystem`    | boolean  | System roles can't be deleted |
| `sortOrder`   | number   | Lower = higher authority      |

### orgMembers

| Field       | Type    | Description            |
| ----------- | ------- | ---------------------- |
| `orgId`     | id      | Organization reference |
| `userId`    | string  | Host auth user ID      |
| `roleId`    | id      | Role reference         |
| `joinedAt`  | number  | Timestamp              |
| `invitedBy` | string? | userId who invited     |

### invitations

| Field       | Type    | Description                                                       |
| ----------- | ------- | ----------------------------------------------------------------- |
| `orgId`     | id      | Organization reference                                            |
| `email`     | string? | Invite target email                                               |
| `phone`     | string? | Invite target phone                                               |
| `roleId`    | id      | Role to assign on accept                                          |
| `invitedBy` | string  | userId                                                            |
| `status`    | string  | `"pending"`, `"accepted"`, `"declined"`, `"expired"`, `"revoked"` |
| `token`     | string  | Hashed cryptographic token                                        |
| `expiresAt` | number  | Expiry timestamp                                                  |

### userProfiles

| Field         | Type    | Description                                       |
| ------------- | ------- | ------------------------------------------------- |
| `userId`      | string  | Host auth user ID (unique)                        |
| `email`       | string? | Synced from auth                                  |
| `phone`       | string? | Synced from auth                                  |
| `displayName` | string? | Display name                                      |
| `avatarUrl`   | string? | Avatar URL                                        |
| `metadata`    | any?    | App-specific data                                 |
| `activeOrgId` | id?     | Currently selected org                            |
| `isBanned`    | boolean | Ban flag                                          |
| `isAdmin`     | boolean | Platform super-admin flag                         |
| `deletedAt`   | number? | Timestamp when soft-deleted (for retention purge) |

### userDevices

| Field          | Type    | Description                                  |
| -------------- | ------- | -------------------------------------------- |
| `userId`       | string  | User reference                               |
| `sessionId`    | string  | Maps to host `authSessions._id`              |
| `deviceName`   | string? | Parsed device name                           |
| `deviceType`   | string? | `"web"`, `"mobile"`, `"tablet"`, `"desktop"` |
| `browser`      | string? | Parsed from user-agent                       |
| `os`           | string? | Parsed from user-agent                       |
| `ipAddress`    | string? | IP hint                                      |
| `lastActiveAt` | number  | Last activity timestamp                      |
| `createdAt`    | number  | First seen timestamp                         |

### impersonationSessions

| Field          | Type    | Description                        |
| -------------- | ------- | ---------------------------------- |
| `adminUserId`  | string  | Admin performing impersonation     |
| `targetUserId` | string  | User being impersonated            |
| `reason`       | string? | Justification                      |
| `startedAt`    | number  | Start timestamp                    |
| `expiresAt`    | number  | TTL expiry                         |
| `endedAt`      | number? | When stopped                       |
| `status`       | string  | `"active"`, `"expired"`, `"ended"` |

### auditLogs

| Field             | Type    | Description                                        |
| ----------------- | ------- | -------------------------------------------------- |
| `orgId`           | id?     | Organization (null for platform-level actions)     |
| `actorUserId`     | string  | Who performed the action                           |
| `effectiveUserId` | string? | Impersonated user (if applicable)                  |
| `action`          | string  | Action name (e.g., `"member.role_changed"`)        |
| `resourceType`    | string  | Resource type (e.g., `"member"`, `"organization"`) |
| `resourceId`      | string? | Affected resource ID                               |
| `metadata`        | any?    | Action-specific payload                            |
| `ipAddress`       | string? | IP hint                                            |
| `timestamp`       | number  | When it happened                                   |

## Configuration Reference

### `createUserOrgAPI(component, config)`

| Option               | Type           | Default              | Description                               |
| -------------------- | -------------- | -------------------- | ----------------------------------------- |
| `roles`              | `RoleConfig[]` | Required             | System roles seeded on org creation       |
| `createPersonalOrg`  | `boolean`      | `false`              | Auto-create a personal org on user signup |
| `invitationExpiryMs` | `number`       | `604800000` (7 days) | Invitation token expiry                   |
| `impersonationTtlMs` | `number`       | `3600000` (1 hour)   | Impersonation session TTL                 |

### `RoleConfig`

| Field         | Type       | Description                |
| ------------- | ---------- | -------------------------- |
| `name`        | `string`   | Role name                  |
| `description` | `string?`  | Human-readable description |
| `permissions` | `string[]` | Permission strings         |
| `sortOrder`   | `number`   | Lower = higher authority   |
| `isSystem`    | `boolean`  | Cannot be deleted by users |

### `createAuthCallbacks(component, config)`

| Option            | Type      | Default | Description                                |
| ----------------- | --------- | ------- | ------------------------------------------ |
| `parseDeviceInfo` | `boolean` | `false` | Parse user-agent into device info on login |

## Host App File Structure

After integration, your Convex directory looks like this:

```
convex/
├── convex.config.ts         # app.use(userOrg)
├── schema.ts                # ...authTables, ...appTables
├── auth.ts                  # convexAuth({ providers, callbacks })
├── http.ts                  # auth.addHttpRoutes(http)
├── userOrg.ts               # createUserOrgAPI(components.userOrg, config)
├── admin.ts                 # createAdminAPI(components.userOrg)
└── _generated/
```

No subdirectories. No polyfills. No adapters. No CLI schema generation.

## Authentication

This component is designed for [Convex Auth](https://labs.convex.dev/auth) but the component itself is auth-agnostic — it only receives `userId` strings. If you use a different auth provider (Clerk, Auth0, etc.), you can still use the component by wiring up the `userId` yourself in the wrapper factory.

## License

Apache-2.0
