import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'Sona <noreply@sona.ai>'
const BASE_URL = process.env.NEXT_PUBLIC_SONA_URL ?? 'https://sona.ai'

// ── Helpers ────────────────────────────────────────────────────────────────

function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:48px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:40px;text-align:center;">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-style:italic;font-weight:400;color:#1a1a1a;letter-spacing:-0.02em;">
            Sona
          </span>
        </td></tr>

        <!-- Divider -->
        <tr><td style="border-top:1px solid rgba(0,0,0,0.06);padding-bottom:40px;"></td></tr>

        <!-- Content -->
        ${content}

        <!-- Footer -->
        <tr><td style="border-top:1px solid rgba(0,0,0,0.06);padding-top:32px;text-align:center;">
          <p style="font-size:12px;color:#b0b0b0;margin:0;">
            © 2026 Sona &nbsp;·&nbsp;
            <a href="${BASE_URL}/privacy" style="color:#b0b0b0;text-decoration:none;">Privacy</a>
            &nbsp;·&nbsp;
            <a href="${BASE_URL}/terms" style="color:#b0b0b0;text-decoration:none;">Terms</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Email functions ─────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Welcome to Sona',
    html: wrap(`
      <tr><td style="padding-bottom:24px;">
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-style:italic;font-weight:400;color:#1a1a1a;margin:0 0 12px;line-height:1.2;">
          Welcome.
        </h1>
        <p style="font-size:15px;font-weight:300;color:#6b6b6b;margin:0 0 24px;line-height:1.7;">
          You're now part of Sona — a place to have real conversations with remarkable people.
        </p>
        <p style="font-size:15px;font-weight:300;color:#6b6b6b;margin:0 0 32px;line-height:1.7;">
          Start by exploring the Sonas available, or create your own.
        </p>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;">
            <a href="${BASE_URL}/explore" style="display:inline-block;background:#1a1a1a;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none;padding:12px 28px;border-radius:980px;letter-spacing:-0.01em;">
              Explore Sonas
            </a>
          </td>
          <td>
            <a href="${BASE_URL}/signup" style="display:inline-block;background:#ffffff;color:#1a1a1a;font-size:14px;font-weight:400;text-decoration:none;padding:12px 28px;border-radius:980px;letter-spacing:-0.01em;border:1px solid rgba(0,0,0,0.15);">
              Create your Sona
            </a>
          </td>
        </tr></table>
      </td></tr>
    `),
  })
}

export async function sendSubscriptionConfirmedEmail(
  to: string,
  portraitName: string,
  portraitSlug: string,
  monthlyPriceCents: number | null,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  const isFree = !monthlyPriceCents
  const priceText = isFree
    ? 'Free'
    : `$${(monthlyPriceCents! / 100).toFixed(0)}/month`

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You're now following ${portraitName}`,
    html: wrap(`
      <tr><td style="padding-bottom:24px;">
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-style:italic;font-weight:400;color:#1a1a1a;margin:0 0 12px;line-height:1.2;">
          You're now following ${portraitName}.
        </h1>
        <p style="font-size:15px;font-weight:300;color:#6b6b6b;margin:0 0 8px;line-height:1.7;">
          Your ${isFree ? 'free' : ''} subscription is active.
          ${!isFree ? `You'll be billed ${priceText}, and can cancel any time from your account.` : ''}
        </p>
        <p style="font-size:15px;font-weight:300;color:#6b6b6b;margin:0 0 32px;line-height:1.7;">
          Start a conversation whenever you're ready.
        </p>
        <a href="${BASE_URL}/sona/${portraitSlug}" style="display:inline-block;background:#1a1a1a;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none;padding:12px 28px;border-radius:980px;letter-spacing:-0.01em;">
          Talk with ${portraitName}
        </a>
      </td></tr>
    `),
  })
}

export async function sendSubscriptionCancelledEmail(
  to: string,
  portraitName: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your subscription to ${portraitName} has ended`,
    html: wrap(`
      <tr><td style="padding-bottom:24px;">
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-style:italic;font-weight:400;color:#1a1a1a;margin:0 0 12px;line-height:1.2;">
          Subscription ended.
        </h1>
        <p style="font-size:15px;font-weight:300;color:#6b6b6b;margin:0 0 24px;line-height:1.7;">
          Your access to ${portraitName} has ended. We hope you enjoyed your conversations.
        </p>
        <p style="font-size:15px;font-weight:300;color:#6b6b6b;margin:0 0 32px;line-height:1.7;">
          You can resubscribe at any time from the Sona page.
        </p>
        <a href="${BASE_URL}/explore" style="display:inline-block;background:#1a1a1a;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none;padding:12px 28px;border-radius:980px;letter-spacing:-0.01em;">
          Explore Sonas
        </a>
      </td></tr>
    `),
  })
}
