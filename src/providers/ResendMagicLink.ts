import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";

export function ResendMagicLink(config: { appName?: string; fromEmail: string }) {
  return Email({
    id: "resend-magic-link",
    maxAge: 15 * 60,
    async sendVerificationRequest({ identifier: email, url }) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: `${config.appName ?? "App"} <${config.fromEmail}>`,
        to: email,
        subject: `Sign in to ${config.appName ?? "the app"}`,
        text: `Click to sign in: ${url}\n\nThis link expires in 15 minutes.`,
      });
    },
  });
}
