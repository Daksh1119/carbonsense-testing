/**
 * CarbonSense — Email utility
 * Supports two providers (auto-detected from env vars):
 *   1. Gmail SMTP via Nodemailer  — uses GMAIL_USER + GMAIL_APP_PASSWORD
 *   2. Resend                     — uses RESEND_API_KEY (fallback)
 *
 * Gmail SMTP setup (recommended for dev/testing):
 *   1. Google Account → Security → 2-Step Verification → enable
 *   2. Google Account → Security → App Passwords → create → copy 16-char password
 *   3. Add to .env.local:
 *        GMAIL_USER=yourgmail@gmail.com
 *        GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
 *
 * Resend setup (production with domain):
 *   1. Sign up at https://resend.com
 *   2. Verify your domain → create API key
 *   3. Add to .env.local:
 *        RESEND_API_KEY=re_xxxxxxxxxxxx
 *        RESEND_FROM_EMAIL=noreply@yourdomain.com
 */

import nodemailer from 'nodemailer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const APP_NAME = 'CarbonSense';

function buildHtml({
  toEmail,
  role,
  organizationName,
  invitedByName,
  expiresAt,
}: {
  toEmail: string;
  role: string;
  organizationName: string;
  invitedByName: string;
  expiresAt: string;
}): { subject: string; html: string } {
  const signupPath = role === 'manager' ? '/signup/manager' : '/signup/employee';
  const signupUrl = `${SITE_URL}${signupPath}?email=${encodeURIComponent(toEmail)}`;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const subject = `You've been invited to ${APP_NAME} as a ${roleLabel} — ${organizationName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden;">

        <tr>
          <td style="background:linear-gradient(135deg,#059669,#0d9488);padding:32px 40px;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;">🌿 ${APP_NAME}</p>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Carbon Intelligence Platform</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px;">
            <h1 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;font-weight:700;">
              You've been invited as a ${roleLabel}
            </h1>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
              <strong style="color:#e2e8f0;">${invitedByName}</strong> has invited you to join
              <strong style="color:#e2e8f0;">${organizationName}</strong> on ${APP_NAME}
              as a <strong style="color:#34d399;">${roleLabel}</strong>.
            </p>

            <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:20px;margin-bottom:28px;">
              <p style="margin:0 0 12px;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">What you get access to</p>
              ${role === 'manager' ? `
              <p style="margin:4px 0;color:#cbd5e1;font-size:13px;">✅ &nbsp;Upload &amp; manage emissions data</p>
              <p style="margin:4px 0;color:#cbd5e1;font-size:13px;">✅ &nbsp;AI-powered recommendations</p>
              <p style="margin:4px 0;color:#cbd5e1;font-size:13px;">✅ &nbsp;Compliance tracking &amp; policy intelligence</p>
              <p style="margin:4px 0;color:#cbd5e1;font-size:13px;">✅ &nbsp;Analytics &amp; trend reports</p>
              <p style="margin:4px 0;color:#cbd5e1;font-size:13px;">✅ &nbsp;Manage team viewers</p>
              ` : `
              <p style="margin:4px 0;color:#cbd5e1;font-size:13px;">✅ &nbsp;View emissions dashboards</p>
              <p style="margin:4px 0;color:#cbd5e1;font-size:13px;">✅ &nbsp;View compliance status &amp; reports</p>
              <p style="margin:4px 0;color:#cbd5e1;font-size:13px;">✅ &nbsp;Track assigned sustainability tasks</p>
              `}
            </div>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#059669;border-radius:10px;">
                  <a href="${signupUrl}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">
                    Create Your Account →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#64748b;font-size:12px;">
              Or copy: <span style="color:#34d399;">${signupUrl}</span>
            </p>
            <p style="margin:0;color:#475569;font-size:12px;">
              ⏳ Invite expires <strong style="color:#94a3b8;">${expiryDate}</strong>.
              Sign up using <strong style="color:#94a3b8;">${toEmail}</strong>.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#0f172a;padding:20px 40px;border-top:1px solid #1e293b;">
            <p style="margin:0;color:#475569;font-size:11px;">
              You're receiving this because an admin at ${organizationName} invited you.
              If unexpected, you can safely ignore this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  return { subject, html };
}

/**
 * Send an invite email using Gmail SMTP (primary) or Resend (fallback).
 * Non-fatal — invite is still created in DB even if email fails.
 */
export async function sendInviteEmail(params: {
  toEmail: string;
  role: string;
  organizationName: string;
  invitedByName: string;
  expiresAt: string;
}): Promise<void> {
  const { subject, html } = buildHtml(params);

  // ── Provider 1: Gmail SMTP ─────────────────────────────────────────────────
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: `"${APP_NAME}" <${process.env.GMAIL_USER}>`,
        to: params.toEmail,
        subject,
        html,
      });

      console.log(`[email] Gmail invite sent to ${params.toEmail}`);
      return;
    } catch (err) {
      console.error('[email] Gmail SMTP error:', err);
      // Fall through to Resend if Gmail fails
    }
  }

  // ── Provider 2: Resend (fallback) ─────────────────────────────────────────
  if (process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('your_api_key')) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

      const { error } = await resend.emails.send({
        from: fromEmail,
        to: params.toEmail,
        subject,
        html,
      });

      if (error) console.error('[email] Resend error:', error);
      else console.log(`[email] Resend invite sent to ${params.toEmail}`);
      return;
    } catch (err) {
      console.error('[email] Resend unexpected error:', err);
    }
  }

  // ── No provider configured ────────────────────────────────────────────────
  console.warn(
    `[email] No email provider configured. Invite created in DB for ${params.toEmail} but no email was sent.\n` +
    '  → Add GMAIL_USER + GMAIL_APP_PASSWORD to .env.local to enable Gmail sending.'
  );
}
