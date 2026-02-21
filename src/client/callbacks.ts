import type { AuthCallbacksConfig } from "./types.js";

/**
 * Parses a user-agent string into device info.
 * Lightweight parser — covers major browsers and OSes.
 */
export function parseUserAgent(ua: string): {
  deviceName?: string;
  deviceType?: "web" | "mobile" | "tablet" | "desktop";
  browser?: string;
  os?: string;
} {
  let browser: string | undefined;
  let os: string | undefined;
  let deviceType: "web" | "mobile" | "tablet" | "desktop" | undefined;

  // Browser detection
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";
  else if (ua.includes("Chrome/") && ua.includes("Safari/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";

  // OS detection
  if (ua.includes("iPhone")) {
    os = "iOS";
    deviceType = "mobile";
  } else if (ua.includes("iPad")) {
    os = "iPadOS";
    deviceType = "tablet";
  } else if (ua.includes("Android")) {
    os = "Android";
    deviceType = ua.includes("Mobile") ? "mobile" : "tablet";
  } else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) {
    os = "macOS";
    deviceType = "desktop";
  } else if (ua.includes("Windows")) {
    os = "Windows";
    deviceType = "desktop";
  } else if (ua.includes("Linux")) {
    os = "Linux";
    deviceType = "desktop";
  }

  // If no specific device type detected but it's a browser
  if (!deviceType && browser) {
    deviceType = "web";
  }

  const deviceName =
    browser && os ? `${browser} on ${os}` : browser || os || undefined;

  return { deviceName, deviceType, browser, os };
}

/**
 * Creates auth callbacks that integrate with the component.
 * Wire these into convexAuth({ callbacks: ... }).
 */
export function createAuthCallbacks(
  component: any,
  config: AuthCallbacksConfig = {},
) {
  return {
    /**
     * Called after a user is created or updated via Convex Auth.
     * Syncs the user's profile data to the component.
     */
    async afterUserCreatedOrUpdated(
      ctx: any,
      args: {
        userId: string;
        existingUserId: string | null;
        profile?: {
          email?: string;
          phone?: string;
          name?: string;
        };
        [key: string]: unknown;
      },
    ) {
      const userId = args.existingUserId ?? args.userId;
      const email = args.profile?.email;

      await ctx.runMutation(component.lib.syncUser, {
        userId,
        email,
        phone: args.profile?.phone,
        name: args.profile?.name,
        ...(config.migrationLinking && { migrationLinking: true }),
      });
    },

    /**
     * Called when a new session is created.
     * Registers the device if parseDeviceInfo is enabled.
     *
     * **Warning:** Convex Auth does NOT call this callback — it only supports
     * `afterUserCreatedOrUpdated` and `redirect`. This only works if your auth
     * provider explicitly invokes `afterSessionCreated`. For Convex Auth, use
     * the `registerDevice` mutation from `createUserOrgAPI()` instead.
     */
    async afterSessionCreated(
      ctx: any,
      args: {
        userId: string;
        sessionId: string;
        userAgent?: string;
        ipAddress?: string;
      },
    ) {
      if (!config.parseDeviceInfo) return;

      let deviceInfo: {
        deviceName?: string;
        deviceType?: "web" | "mobile" | "tablet" | "desktop";
        browser?: string;
        os?: string;
      } = {};

      if (args.userAgent) {
        deviceInfo = parseUserAgent(args.userAgent);
      }

      await ctx.runMutation(component.lib.registerDevice, {
        userId: args.userId,
        sessionId: args.sessionId,
        ...deviceInfo,
        ipAddress: args.ipAddress,
      });
    },
  };
}
