import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";

/**
 * Génération assistée par IA d'un projet d'article pour la « Lettre du Bâtonnier »
 * (CDC §2.15 / FR-BAT-01). Utilise l'API Claude (`claude-opus-4-8`) si
 * ANTHROPIC_API_KEY est configurée ; sinon, repli sur un gabarit local
 * (mode simulation) pour ne jamais bloquer la fonctionnalité.
 */

export const iaDisponible = Boolean(process.env.ANTHROPIC_API_KEY);

const client = iaDisponible ? new Anthropic() : null;

/** Gabarit de repli (sans IA) — structure l'article à compléter. */
function brouillonLocal(mois: string, theme: string): string {
  return (
    `Lettre du Bâtonnier — ${mois}\n\n` +
    `Thème : ${theme}.\n\n` +
    `Chères Consœurs, chers Confrères,\n\n` +
    `Le thème de ce mois, « ${theme} », nous invite à une réflexion collective sur ` +
    `notre responsabilité au sein du Barreau de Pointe-Noire. En tant qu'auxiliaires de ` +
    `justice, nous portons une exigence particulière d'exemplarité et d'engagement.\n\n` +
    `[Développement à compléter par le Bâtonnier.]\n\n` +
    `Confraternellement,\nLe Bâtonnier`
  );
}

const SYSTEM = `Tu rédiges l'éditorial mensuel « La Lettre du Bâtonnier » du Barreau de Pointe-Noire (Ordre National des Avocats du Congo).
Registre : institutionnel, confraternel, sobre et digne — pas de superlatifs creux ni de langue de bois.
Structure : un titre, une adresse « Chères Consœurs, chers Confrères, », trois à quatre paragraphes développant le thème en lien avec la déontologie et la vie de l'Ordre, puis la formule « Confraternellement, Le Bâtonnier ».
Longueur : 350 à 500 mots. Réponds uniquement avec le texte de l'article, sans commentaire.`;

export async function genererArticleLettre(
  mois: string,
  theme: string
): Promise<{ texte: string; modele: string; simule: boolean }> {
  if (!client) {
    return { texte: brouillonLocal(mois, theme), modele: "gabarit-local", simule: true };
  }
  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Rédige le projet d'article de la Lettre du Bâtonnier pour le mois de « ${mois} », sur le thème : « ${theme} ».`,
        },
      ],
    });
    const texte = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { texte: texte || brouillonLocal(mois, theme), modele: message.model, simule: false };
  } catch (err) {
    logger.warn({ err }, "Génération IA indisponible — repli sur le gabarit local");
    return { texte: brouillonLocal(mois, theme), modele: "gabarit-local", simule: true };
  }
}
