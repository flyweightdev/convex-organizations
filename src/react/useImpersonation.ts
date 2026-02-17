import { useQuery, useMutation } from "convex/react";
import { useUserOrgContext } from "./provider.js";
import { useCallback } from "react";

export function useImpersonation() {
  const { api, adminApi } = useUserOrgContext();

  // Always call hooks in the same order to satisfy React rules of hooks.
  // When adminApi is unavailable, use a valid query ref with "skip" as a no-op.
  const activeImpersonation = useQuery(
    adminApi ? adminApi.getActiveImpersonation : api.getMyProfile,
    adminApi ? {} : "skip",
  );

  // useMutation needs a valid ref; fallback won't be invoked (we throw first).
  const startMutation = useMutation(
    adminApi ? adminApi.startImpersonation : (api.updateMyProfile as any),
  );
  const stopMutation = useMutation(
    adminApi ? adminApi.stopImpersonation : (api.updateMyProfile as any),
  );

  const startImpersonation = useCallback(
    async (targetUserId: string, reason?: string) => {
      if (!adminApi) {
        throw new Error("Admin API not configured in UserOrgProvider");
      }
      await startMutation({ targetUserId, reason });
    },
    [adminApi, startMutation],
  );

  const stopImpersonation = useCallback(async () => {
    if (!adminApi) {
      throw new Error("Admin API not configured in UserOrgProvider");
    }
    await stopMutation({});
  }, [adminApi, stopMutation]);

  return {
    isImpersonating: adminApi ? !!activeImpersonation : false,
    targetUser:
      adminApi && activeImpersonation
        ? {
            userId: activeImpersonation.targetUserId,
            reason: activeImpersonation.reason,
            expiresAt: activeImpersonation.expiresAt,
          }
        : null,
    startImpersonation,
    stopImpersonation,
  };
}
