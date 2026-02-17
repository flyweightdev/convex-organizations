import { defineApp } from "convex/server";
import userOrg from "@flyweightdev/convex-organizations/convex.config";

const app = defineApp();
app.use(userOrg);

export default app;
