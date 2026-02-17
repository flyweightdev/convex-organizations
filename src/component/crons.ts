import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();

crons.daily(
  "purge deleted users",
  { hourUTC: 3, minuteUTC: 0 },
  internal.lib.purgeDeletedUsers,
);

crons.daily(
  "purge deleted orgs",
  { hourUTC: 3, minuteUTC: 30 },
  internal.lib.purgeDeletedOrgs,
);

crons.hourly(
  "expire impersonation sessions",
  { minuteUTC: 0 },
  internal.lib.expireImpersonationSessions,
);

export default crons;
