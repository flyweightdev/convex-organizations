import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";

export function ResendOTP(config: { appName?: string; fromEmail: string }) {
  return Email({
    id: "resend-otp",
    maxAge: 5 * 60,
    async sendVerificationRequest({ identifier: email, token }) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: `${config.appName ?? "App"} <${config.fromEmail}>`,
        to: email,
        subject: `Your verification code: ${token}`,
        text: `Your code is ${token}. It expires in 5 minutes.`,
      });
    },
  });
}
