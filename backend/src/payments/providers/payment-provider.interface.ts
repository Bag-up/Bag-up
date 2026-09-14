import { PaymentMethod } from '@prisma/client';

/**
 * Statut normalisé renvoyé par une passerelle de paiement, indépendant du
 * vocabulaire propre à chaque fournisseur (Bictorys, Stripe, etc.).
 */
export type ProviderChargeStatus = 'pending' | 'processing' | 'success' | 'failed';

export interface ChargeCustomer {
  name?: string;
  phone?: string;
  email?: string;
  /** Code pays ISO (SN, CI, FR...). */
  country?: string;
}

export interface InitiateChargeInput {
  /** Id du Payment en base, utilisé comme référence marchande unique. */
  paymentId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  /** Code pays Bictorys (SN, CI...) déduit du client. */
  country?: string;
  customer?: ChargeCustomer;
  /** URLs de redirection après paiement (web/checkout). */
  successRedirectUrl?: string;
  errorRedirectUrl?: string;
  /** OTP Orange Money CI/BF uniquement. */
  otp?: string;
}

export interface InitiateChargeResult {
  provider: string;
  /** Référence de la transaction côté passerelle. */
  providerRef?: string;
  status: ProviderChargeStatus;
  /** URL de redirection générique (fallback). */
  redirectUrl?: string;
  /** Lien direct (deep link Wave, page checkout carte, client_secret Stripe...). */
  link?: string;
  /** QR code base64 (Wave desktop). */
  qrCode?: string;
  /** Message USSD à afficher (Orange Money). */
  message?: string;
  /** Payload brut du fournisseur, pour debug. */
  raw?: unknown;
}

export interface ParsedWebhook {
  /** Id de l'événement côté fournisseur (idempotence). */
  eventId: string;
  /** Référence marchande = id du Payment. */
  paymentRef?: string;
  /** Référence transaction côté fournisseur. */
  providerRef?: string;
  status: ProviderChargeStatus;
  amount?: number;
  currency?: string;
}

/**
 * Contrat commun à toutes les passerelles de paiement. Permet d'ajouter un
 * nouveau fournisseur sans toucher au reste du code (PaymentsService).
 */
export interface PaymentProvider {
  /** Identifiant stable stocké en base (ex: "bictorys", "stripe", "mock"). */
  readonly name: string;

  /** True si les clés/variables d'environnement nécessaires sont présentes. */
  isConfigured(): boolean;

  /** Crée une charge (paiement entrant) auprès de la passerelle. */
  initiateCharge(input: InitiateChargeInput): Promise<InitiateChargeResult>;

  /** Valide l'authenticité d'un webhook entrant (signature/secret). */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): boolean;

  /** Extrait les champs utiles d'un payload webhook validé. */
  parseWebhook(rawBody: string): ParsedWebhook;
}
