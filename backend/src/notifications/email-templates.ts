/** Brand Bag'up email templates for Resend (table-based HTML, Gmail-safe). */

export interface EmailPayload {
  subject: string;
  html: string;
}

const BRAND = {
  primary: '#0D8F8F',
  primaryLight: '#14B8B8',
  secondary: '#F7E300',
  accent: '#F04A3A',
  gray900: '#111827',
  gray600: '#4B5563',
  gray500: '#6B7280',
  gray200: '#E5E7EB',
  gray50: '#F8FAFB',
  white: '#FFFFFF',
  support: 'support@bagupafrica.com',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.gray50};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.gray50};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${BRAND.white};border-radius:12px;overflow:hidden;border:1px solid ${BRAND.gray200};">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryLight});padding:28px 32px;">
              <div style="font-size:28px;font-weight:700;color:${BRAND.white};letter-spacing:-0.5px;">Bag'up</div>
              <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.9);">Livraison &amp; services au Sénégal</div>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${BRAND.secondary};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 28px;color:${BRAND.gray900};font-size:15px;line-height:1.55;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:${BRAND.gray50};border-top:1px solid ${BRAND.gray200};font-size:12px;line-height:1.5;color:${BRAND.gray500};">
              Besoin d'aide ? Écrivez-nous à
              <a href="mailto:${BRAND.support}" style="color:${BRAND.primary};text-decoration:none;">${BRAND.support}</a><br />
              Cet email est envoyé automatiquement — merci de ne pas y répondre.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function infoRow(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 0;color:${BRAND.gray500};font-size:13px;width:40%;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;color:${BRAND.gray900};font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-top:1px solid ${BRAND.gray200};border-bottom:1px solid ${BRAND.gray200};">${cells}</table>`;
}

function codeBox(code: string): string {
  return `<div style="margin:24px 0;padding:20px;text-align:center;background:${BRAND.gray50};border:1px dashed ${BRAND.primary};border-radius:10px;">
    <div style="font-size:12px;color:${BRAND.gray500};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Votre code</div>
    <div style="font-size:32px;font-weight:700;letter-spacing:4px;color:${BRAND.primary};">${escapeHtml(code)}</div>
  </div>`;
}

export function passwordResetEmail(params: {
  firstName?: string | null;
  code: string;
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const subject = "Bag'up — Réinitialisation de mot de passe";
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0 0 8px;color:${BRAND.gray600};">Vous avez demandé à réinitialiser votre mot de passe. Utilisez le code ci-dessous dans l'application :</p>
    ${codeBox(params.code)}
    <p style="margin:0;color:${BRAND.gray600};">Ce code est valable <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
  `,
  );
  return { subject, html };
}

/** Code de vérification compte — diaspora (hors SMS Sénégal). */
export function phoneVerificationEmail(params: {
  firstName?: string | null;
  code: string;
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const subject = "Bag'up — Code de vérification";
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0 0 8px;color:${BRAND.gray600};">Pour confirmer votre compte Bag'up, saisissez ce code dans l'application :</p>
    ${codeBox(params.code)}
    <p style="margin:0;color:${BRAND.gray600};">Ce code est valable <strong>5 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
  `,
  );
  return { subject, html };
}

/** Confirmation d'inscription — client. */
export function welcomeClientEmail(params: {
  firstName?: string | null;
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const subject = "Bag'up — Bienvenue, inscription confirmée";
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0 0 12px;color:${BRAND.gray600};">Votre compte client Bag'up est bien créé. Merci de nous faire confiance.</p>
    <p style="margin:0 0 12px;color:${BRAND.gray600};">Vous pouvez dès maintenant commander une course, une livraison, un panier Anti-Gaspi ou un produit Marketplace depuis l'application.</p>
    <p style="margin:0;color:${BRAND.gray600};">Besoin d'aide ? Écrivez-nous à <a href="mailto:${BRAND.support}" style="color:${BRAND.primary};">${BRAND.support}</a>.</p>
  `,
  );
  return { subject, html };
}

/** Inscription presta / commerçant — dossier en attente de validation. */
export function accountPendingReviewEmail(params: {
  firstName?: string | null;
  role: 'provider' | 'merchant';
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const roleLabel = params.role === 'merchant' ? 'commerçant' : 'prestataire';
  const subject = `Bag'up — Compte ${roleLabel} en cours de validation`;
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0 0 12px;color:${BRAND.gray600};">Votre inscription <strong>${escapeHtml(roleLabel)}</strong> a bien été reçue.</p>
    <p style="margin:0 0 12px;color:${BRAND.gray600};">Votre compte est actuellement <strong>en attente de validation</strong> par l'équipe Bag'up. Vous recevrez un email (et un SMS) dès qu'il sera activé.</p>
    <p style="margin:0;color:${BRAND.gray600};">En général, la vérification prend quelques heures. Merci pour votre patience.</p>
  `,
  );
  return { subject, html };
}

/** Alerte staff : nouveau presta / commerçant à valider dans le back-office. */
export function staffAccountPendingReviewEmail(params: {
  staffFirstName?: string | null;
  applicantName: string;
  role: 'provider' | 'merchant';
  phone: string;
  email?: string | null;
  reviewUrl: string;
}): EmailPayload {
  const name = params.staffFirstName?.trim() || 'Bonjour';
  const roleLabel = params.role === 'merchant' ? 'commerçant' : 'prestataire';
  const subject = `Bag'up — Compte ${roleLabel} à valider`;
  const rows: Array<[string, string]> = [
    ['Nom', params.applicantName],
    ['Type', roleLabel],
    ['Téléphone', params.phone],
  ];
  if (params.email?.trim()) rows.push(['Email', params.email.trim()]);
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0 0 12px;color:${BRAND.gray600};">Un nouveau compte <strong>${escapeHtml(roleLabel)}</strong> attend votre validation.</p>
    ${infoRow(rows)}
    <p style="margin:24px 0 0;text-align:center;">
      <a href="${escapeHtml(params.reviewUrl)}" style="display:inline-block;padding:12px 22px;background:${BRAND.primary};color:${BRAND.white};text-decoration:none;border-radius:8px;font-weight:600;">Ouvrir dans le back-office</a>
    </p>
    <p style="margin:16px 0 0;color:${BRAND.gray500};font-size:13px;text-align:center;">Ou copiez ce lien : ${escapeHtml(params.reviewUrl)}</p>
  `,
  );
  return { subject, html };
}

/** Compte presta / commerçant validé par l'admin. */
export function accountActivatedEmail(params: {
  firstName?: string | null;
  role: 'provider' | 'merchant';
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const roleLabel = params.role === 'merchant' ? 'commerçant' : 'prestataire';
  const subject = `Bag'up — Votre compte ${roleLabel} est actif`;
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0 0 12px;color:${BRAND.gray600};">Bonne nouvelle : votre compte <strong>${escapeHtml(roleLabel)}</strong> Bag'up est maintenant <strong>actif</strong>.</p>
    <p style="margin:0 0 12px;color:${BRAND.gray600};">Connectez-vous à l'application pour commencer à recevoir des missions ou gérer votre boutique.</p>
    <p style="margin:0;color:${BRAND.gray600};">Bienvenue dans la communauté Bag'up.</p>
  `,
  );
  return { subject, html };
}

export function notificationEmail(params: {
  firstName?: string | null;
  title: string;
  message: string;
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const subject = `Bag'up — ${params.title}`;
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:${BRAND.primary};">${escapeHtml(params.title)}</p>
    <p style="margin:0;color:${BRAND.gray600};white-space:pre-wrap;">${escapeHtml(params.message)}</p>
  `,
  );
  return { subject, html };
}

export function missionCreatedEmail(params: {
  firstName?: string | null;
  serviceType: string;
  pickupAddress: string;
  deliveryAddress: string;
  price?: number | null;
  missionId?: string;
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const subject = "Bag'up — Confirmation de votre demande";
  const rows: Array<[string, string]> = [
    ['Service', params.serviceType],
    ['Retrait', params.pickupAddress],
    ['Livraison', params.deliveryAddress],
  ];
  if (params.price != null && Number.isFinite(params.price)) {
    rows.push(['Montant', `${Math.round(params.price).toLocaleString('fr-FR')} FCFA`]);
  }
  if (params.missionId) {
    rows.push(['Référence', params.missionId.slice(0, 8).toUpperCase()]);
  }
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0;color:${BRAND.gray600};">Votre demande a bien été enregistrée. Voici le récapitulatif :</p>
    ${infoRow(rows)}
    <p style="margin:0;color:${BRAND.gray600};">Suivez l'avancement depuis l'application Bag'up.</p>
  `,
  );
  return { subject, html };
}

export function missionAcceptedEmail(params: {
  firstName?: string | null;
  providerName: string;
  serviceType?: string | null;
  pickupAddress?: string | null;
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const subject = "Bag'up — Mission acceptée";
  const rows: Array<[string, string]> = [['Prestataire', params.providerName]];
  if (params.serviceType) rows.push(['Service', params.serviceType]);
  if (params.pickupAddress) rows.push(['Retrait', params.pickupAddress]);
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0;color:${BRAND.gray600};"><strong>${escapeHtml(params.providerName)}</strong> a accepté votre mission. Suivez la livraison en direct dans l'app.</p>
    ${infoRow(rows)}
  `,
  );
  return { subject, html };
}

export function missionDeliveredEmail(params: {
  firstName?: string | null;
  serviceType?: string | null;
  deliveryAddress?: string | null;
  providerName?: string | null;
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const subject = "Bag'up — Accusé de livraison";
  const rows: Array<[string, string]> = [];
  if (params.serviceType) rows.push(['Service', params.serviceType]);
  if (params.deliveryAddress) rows.push(['Livré à', params.deliveryAddress]);
  if (params.providerName) rows.push(['Prestataire', params.providerName]);
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0;color:${BRAND.gray600};">Bonne nouvelle : votre livraison est <strong>terminée</strong>.</p>
    ${rows.length ? infoRow(rows) : ''}
    <p style="margin:16px 0 0;color:${BRAND.gray600};">Merci d'avoir choisi Bag'up. N'hésitez pas à noter votre prestataire dans l'app.</p>
  `,
  );
  return { subject, html };
}

export type PaymentReceiptKind = 'mission' | 'subscription' | 'marketplace' | 'other';

export function paymentReceiptEmail(params: {
  firstName?: string | null;
  amount: number;
  currency?: string;
  method?: string | null;
  transactionId?: string | null;
  kind: PaymentReceiptKind;
  label?: string | null;
}): EmailPayload {
  const name = params.firstName?.trim() || 'Bonjour';
  const currency = params.currency || 'FCFA';
  const kindLabel: Record<PaymentReceiptKind, string> = {
    mission: 'Paiement mission',
    subscription: 'Paiement abonnement',
    marketplace: 'Paiement marketplace',
    other: 'Paiement',
  };
  const subject = `Bag'up — Accusé de paiement`;
  const amountStr = `${Math.round(params.amount).toLocaleString('fr-FR')} ${currency}`;
  const rows: Array<[string, string]> = [
    ['Type', params.label || kindLabel[params.kind]],
    ['Montant', amountStr],
  ];
  if (params.method) rows.push(['Méthode', params.method]);
  if (params.transactionId) rows.push(['Référence', params.transactionId]);
  const html = layout(
    subject,
    `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(name)},</p>
    <p style="margin:0;color:${BRAND.gray600};">Nous confirmons la réception de votre paiement.</p>
    ${infoRow(rows)}
    <p style="margin:0;color:${BRAND.gray600};">Conservez cet email comme preuve de paiement.</p>
  `,
  );
  return { subject, html };
}
