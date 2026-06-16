import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { logger } from "./logger.js";

/**
 * Couche temps réel (WebSocket) de la messagerie. Pousse aux clients concernés
 * un signal « rafraîchir » dès qu'un message est émis, afin que les pastilles de
 * non-lus et les fils ouverts se mettent à jour instantanément (le sondage HTTP
 * reste en filet de sécurité). Le serveur ne calcule pas d'état par client : il
 * signale, le client recharge l'état autoritatif via l'API.
 */

/** Socket annotée de son identité applicative + vivacité (heartbeat). */
interface SocketClient extends WebSocket {
  membreId?: number | null;
  vivant?: boolean;
}

const ROLES_ADMIN: Role[] = ["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE", "ADMIN"];

// Registres de diffusion : avocats (par membreId) et boîte administration.
const parMembre = new Map<number, Set<SocketClient>>();
const administration = new Set<SocketClient>();

export interface EvenementRealtime {
  type: "messagerie";
  conversationId?: number;
}

function diffuser(sockets: Iterable<SocketClient>, evt: EvenementRealtime) {
  const payload = JSON.stringify(evt);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch { /* socket en cours de fermeture */ }
    }
  }
}

/** Notifie en temps réel des avocats (par membreId). */
export function realtimeMembres(membreIds: number[], evt: EvenementRealtime) {
  for (const id of membreIds) {
    const set = parMembre.get(id);
    if (set) diffuser(set, evt);
  }
}

/** Notifie en temps réel les officiers connectés (boîte administration). */
export function realtimeAdministration(evt: EvenementRealtime) {
  diffuser(administration, evt);
}

function retirer(ws: SocketClient) {
  administration.delete(ws);
  if (ws.membreId != null) {
    const set = parMembre.get(ws.membreId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) parMembre.delete(ws.membreId);
    }
  }
}

/**
 * Initialise le serveur WebSocket sur /ws. Authentification par JWT en query
 * (?token=) — le rôle/membreId est relu en base (à jour même après changement).
 * Un avocat rejoint son canal `membreId` ; un officier la boîte administration.
 * Heartbeat ping/pong pour purger les connexions mortes.
 */
export function initRealtime(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: SocketClient, req) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const token = url.searchParams.get("token") ?? "";
      const payload = jwt.verify(token, env.jwtSecret) as unknown as { sub: number };
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true, actif: true, membreId: true },
      });
      if (!user || !user.actif) return ws.close(4001, "unauthorized");

      if (user.role === "AVOCAT" && user.membreId != null) {
        ws.membreId = user.membreId;
        let set = parMembre.get(user.membreId);
        if (!set) { set = new Set(); parMembre.set(user.membreId, set); }
        set.add(ws);
      } else if (ROLES_ADMIN.includes(user.role)) {
        administration.add(ws);
      } else {
        return ws.close(4003, "forbidden");
      }

      ws.vivant = true;
      ws.on("pong", () => { ws.vivant = true; });
      ws.on("close", () => retirer(ws));
      ws.on("error", () => retirer(ws));
    } catch {
      ws.close(4001, "unauthorized");
    }
  });

  // Heartbeat : purge les connexions sans réponse au ping (toutes les 30 s).
  const battement = setInterval(() => {
    for (const ws of wss.clients as Set<SocketClient>) {
      if (ws.vivant === false) { ws.terminate(); continue; }
      ws.vivant = false;
      try { ws.ping(); } catch { /* ignore */ }
    }
  }, 30000);
  battement.unref?.();
  wss.on("close", () => clearInterval(battement));

  logger.info("WebSocket temps réel prêt sur /ws");
  return wss;
}
