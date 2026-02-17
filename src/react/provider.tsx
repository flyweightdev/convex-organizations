import { createContext, useContext } from "react";
import type { UserOrgApi, AdminApi, UserOrgContextValue } from "./types.js";

const UserOrgContext = createContext<UserOrgContextValue | null>(null);

export function useUserOrgContext(): UserOrgContextValue {
  const ctx = useContext(UserOrgContext);
  if (!ctx) {
    throw new Error("useUserOrgContext must be used within a UserOrgProvider");
  }
  return ctx;
}

export function UserOrgProvider({
  api,
  adminApi,
  children,
}: {
  api: UserOrgApi;
  adminApi?: AdminApi;
  children: React.ReactNode;
}) {
  return (
    <UserOrgContext.Provider value={{ api, adminApi }}>
      {children}
    </UserOrgContext.Provider>
  );
}
