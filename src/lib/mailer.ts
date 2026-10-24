import nodemailer, { type Transporter } from "nodemailer";
import { PRODUCT_NAME } from "@explita/infra-protocol";

export type SmtpHostOptions = {
  host: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  url?: never;
  from: string;
};

export type SmtpUrlOptions = {
  url: string;
  host?: never;
  port?: never;
  secure?: never;
  auth?: never;
  from: string;
};

export type SmtpOptions = SmtpHostOptions | SmtpUrlOptions;

export type SendOtpOptions = {
  smtp?: SmtpOptions;
};

let transportInstance: Transporter | null = null;

export function getTransporter(options?: SmtpOptions): Transporter | null {
  if (transportInstance) return transportInstance;

  if (options) {
    if ("url" in options && options.url) {
      transportInstance = nodemailer.createTransport(options.url);
      return transportInstance;
    }
    if ("host" in options && options.host) {
      const port = Number(options.port || 587);
      const secure = options.secure ?? port === 465;
      transportInstance = nodemailer.createTransport({
        host: options.host,
        port,
        secure,
        auth: options.auth
          ? {
              user: options.auth.user,
              pass: options.auth.pass,
            }
          : undefined,
      });
      return transportInstance;
    }
  }

  return null;
}

export async function sendOTP(
  email: string,
  otp: string,
  options?: SendOtpOptions,
): Promise<boolean> {
  const from = options?.smtp?.from;
  const transporter = getTransporter(options?.smtp);

  if (!transporter) {
    // If running without an explicit SMTP configuration, log to console for instant DX
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n======================================================`);
      console.log(`[tunnel-auth] 🔑 DEV OTP CODE FOR ${email}: ${otp}`);
      console.log(
        `[tunnel-auth] (Pass 'smtp' options to registerTunnelPlugin for email delivery)`,
      );
      console.log(`======================================================\n`);
      return true;
    }

    console.error(
      "[tunnel-auth] No SMTP options provided to registerTunnelPlugin.",
    );
    return false;
  }

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: `${otp} is your ${PRODUCT_NAME.tunnel} verification code`,
      text: `Your ${PRODUCT_NAME.tunnel} verification code is: ${otp}\n\nThis code is valid for 10 minutes.\nEnter it in your terminal to complete verification.`,
      html: getOtpHtml(otp),
    });

    return true;
  } catch (err) {
    console.error(
      "[tunnel-auth] Failed to send OTP email via nodemailer:",
      err,
    );
    return false;
  }
}

export function getOtpHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${PRODUCT_NAME.tunnel} Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0d0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0c0d0e; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 36px 32px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);">
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 24px;">
              <span style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #06b6d4;">${PRODUCT_NAME.tunnel}</span>
              <h1 style="margin: 8px 0 0; font-size: 22px; font-weight: 700; color: #ffffff;">Your Verification Code</h1>
            </td>
          </tr>
          <!-- Body Text -->
          <tr>
            <td style="font-size: 14px; line-height: 22px; color: #a1a1aa; padding-bottom: 24px;">
              Enter this 6-digit code in your terminal to authenticate your <code style="background-color: #27272a; color: #e4e4e7; padding: 2px 6px; border-radius: 4px; font-family: monospace;">eta</code> CLI session:
            </td>
          </tr>
          <!-- OTP Code Box -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="background-color: #09090b; border: 1px solid #3f3f46; border-radius: 8px; padding: 18px 24px; display: inline-block;">
                <span style="font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #38bdf8;">${otp}</span>
              </div>
            </td>
          </tr>
          <!-- Expiration Notice -->
          <tr>
            <td style="font-size: 13px; line-height: 20px; color: #71717a; border-top: 1px solid #27272a; padding-top: 20px;">
              ⏱ This code is valid for <strong>10 minutes</strong>. If you did not request this verification, you can safely ignore this email.
            </td>
          </tr>
        </table>
        <!-- Footer -->
        <table role="presentation" width="100%" style="max-width: 480px; padding-top: 20px;">
          <tr>
            <td align="center" style="font-size: 12px; color: #52525b;">
              © ${new Date().getFullYear()} Explita. Encrypted reverse tunnels for developers.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
