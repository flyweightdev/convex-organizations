import { Phone } from "@convex-dev/auth/providers/Phone";
import Twilio from "twilio";

export function TwilioOTP(config: { appName?: string } = {}) {
  return Phone({
    id: "twilio-otp",
    maxAge: 5 * 60,
    async sendVerificationRequest({ identifier: phone, token }) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      if (!accountSid) {
        throw new Error(
          "Missing TWILIO_ACCOUNT_SID environment variable. Set it in the Convex Dashboard.",
        );
      }
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (!authToken) {
        throw new Error(
          "Missing TWILIO_AUTH_TOKEN environment variable. Set it in the Convex Dashboard.",
        );
      }
      const fromNumber = process.env.TWILIO_FROM_NUMBER;
      if (!fromNumber) {
        throw new Error(
          "Missing TWILIO_FROM_NUMBER environment variable. Set it in the Convex Dashboard.",
        );
      }

      const client = Twilio(accountSid, authToken);
      await client.messages.create({
        to: phone,
        from: fromNumber,
        body: `${config.appName ?? "App"}: Your code is ${token}`,
      });
    },
  });
}
