import { defineAuth } from "@aws-amplify/backend";

// Email one-time code (no password to remember) and optional passkeys. Invite only:
// self sign-up is turned off in backend.ts. Cognito sends the mails itself.
export const auth = defineAuth({
  loginWith: {
    email: {
      otpLogin: true,
      userInvitation: {
        emailSubject: "You are invited to Revenant",
        emailBody: (user, code) =>
          `You can now sign in to Revenant as ${user()}. Use your email address and the one-time code we send you. (Temporary password, only if asked: ${code()})`,
      },
    },
    webAuthn: true,
  },
  groups: ["admin"],
});
