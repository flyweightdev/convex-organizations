import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from "convex/server";

// --- Context types for component method calls ---

export type RunQueryCtx = {
  runQuery: <Query extends FunctionReference<"query", "internal">>(
    query: Query,
    args: FunctionArgs<Query>,
  ) => Promise<FunctionReturnType<Query>>;
};

export type RunMutationCtx = RunQueryCtx & {
  runMutation: <Mutation extends FunctionReference<"mutation", "internal">>(
    mutation: Mutation,
    args: FunctionArgs<Mutation>,
  ) => Promise<FunctionReturnType<Mutation>>;
};

export type RunActionCtx = RunMutationCtx & {
  runAction: <Action extends FunctionReference<"action", "internal">>(
    action: Action,
    args: FunctionArgs<Action>,
  ) => Promise<FunctionReturnType<Action>>;
};

// --- Role configuration ---

export interface RoleConfig {
  name: string;
  description?: string;
  permissions: string[];
  sortOrder: number;
  isSystem: boolean;
}

// --- User Org API configuration ---

export interface UserOrgConfig {
  roles: RoleConfig[];
  createPersonalOrg?: boolean;
  invitationExpiryMs?: number;
  impersonationTtlMs?: number;
}

// --- Auth callback configuration ---

export interface AuthCallbacksConfig {
  parseDeviceInfo?: boolean;
  migrationLinking?: boolean;
}

// --- Expand helper (makes complex types readable) ---

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// --- UseApi mapped type (converts public refs to internal) ---

export type UseApi<API> = Expand<{
  [mod in keyof API]: API[mod] extends FunctionReference<
    infer FType,
    "public",
    infer FArgs,
    infer FReturnType,
    infer FComponentPath
  >
    ? FunctionReference<
        FType,
        "internal",
        FArgs,
        FReturnType,
        FComponentPath
      >
    : UseApi<API[mod]>;
}>;
