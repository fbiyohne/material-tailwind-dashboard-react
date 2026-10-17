import { useEffect } from "react";
import { onRealtime } from "../api/realtime";

/**
 * Abonne une page de messagerie aux événements temps réel : à chaque nouveau
 * message, recharge la liste et, si le fil concerné est ouvert, le fil détaillé.
 * Partagé par l'espace avocat et le back-office.
 */
export function useMessagerieRealtime({ selId, onListe, onFilActif }) {
  useEffect(
    () => onRealtime((evt) => {
      if (evt.type !== "messagerie") return;
      onListe?.();
      if (selId && (!evt.conversationId || evt.conversationId === selId)) onFilActif?.(selId);
    }),
    [selId], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
