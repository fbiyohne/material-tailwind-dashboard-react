import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";

/**
 * PaymentProvider — abstraction des passerelles de paiement. Sans identifiants
 * marchands, le fournisseur « sandbox » est actif : il simule le cycle de vie
 * d'un paiement sans appel externe. Les adaptateurs réels (MTN MoMo, Airtel
 * Money, agrégateur carte/banque) se branchent ici via les variables
 * d'environnement, sans changer les appelants.
 *
 * Important (carte) : l'application ne manipule jamais de numéro de carte —
 * l'adaptateur réel redirige vers la page hébergée du prestataire (PCI SAQ-A).
 */
export const CANAUX = ["MTN", "AIRTEL", "CARTE", "VIREMENT"] as const;
export type Canal = (typeof CANAUX)[number];

// Sandbox tant qu'aucun fournisseur n'est configuré.
export const modeSandbox = !process.env.PAYMENT_PROVIDER;

export function nouvelleReference(): string {
  return `PAY-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

/**
 * Initie un paiement auprès de la passerelle. En sandbox : renvoie une simple
 * instruction. En réel : l'adaptateur appellerait l'API du fournisseur et
 * renverrait une URL de redirection (carte) ou une demande d'approbation
 * mobile (Mobile Money).
 */
export async function initierPaiement(opts: { ref: string; canal: Canal; montant: number; tel?: string }): Promise<{ redirectUrl?: string; instruction: string }> {
  if (modeSandbox) {
    return { instruction: `Sandbox : confirmez le paiement ${opts.ref} (${opts.canal}) pour simuler le retour de la passerelle.` };
  }
  // Point d'extension : implémenter l'appel réel selon PAYMENT_PROVIDER
  // (MTN MoMo / Airtel Money request-to-pay, ou page hébergée de l'agrégateur).
  throw new Error("Adaptateur de paiement non implémenté — configurez PAYMENT_PROVIDER.");
}

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook de passerelle (réel).
 * NB : une intégration réelle doit signer le corps **brut** ; capter le raw
 * body au montage de la route le moment venu.
 */
export function verifierSignatureWebhook(corpsBrut: string, signature: string | undefined): boolean {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const attendu = createHmac("sha256", secret).update(corpsBrut).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(attendu), Buffer.from(signature));
  } catch {
    return false;
  }
}
