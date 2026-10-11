import { describe, it, expect, vi } from "vitest";
import { spawn } from "node:child_process";
import os from "node:os";

/**
 * Revue R1-4 : l'API n'écoute que sur l'interface donnée par HOST. Une démonstration
 * sur réseau partagé lance l'instance avec HOST=127.0.0.1 (relancer-test.ps1) : la
 * machine elle-même la joint, une autre adresse du poste (réseau local) non.
 * Sans HOST, comportement inchangé (toutes les interfaces).
 */
const PORT = 4000 + 700 + Math.floor(Math.random() * 200);
const sonde = (hote: string) =>
  fetch(`http://${hote}:${PORT}/api/health`, { signal: AbortSignal.timeout(2000) }).then((r) => r.status, () => 0);
const adresseLocale = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;

describe("écoute de l'API (HOST)", () => {
  it("env.host lit HOST, 0.0.0.0 par défaut", async () => {
    const avant = process.env.HOST;
    try {
      delete process.env.HOST;
      vi.resetModules();
      expect((await import("../src/env.js")).env.host).toBe("0.0.0.0");
      process.env.HOST = "127.0.0.1";
      vi.resetModules();
      expect((await import("../src/env.js")).env.host).toBe("127.0.0.1");
    } finally {
      if (avant === undefined) delete process.env.HOST; else process.env.HOST = avant;
    }
  });

  it("avec HOST=127.0.0.1, le serveur répond sur 127.0.0.1 et pas sur l'adresse réseau du poste", async () => {
    const p = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
      env: { ...process.env, HOST: "127.0.0.1", PORT: String(PORT), LOG_LEVEL: "silent" }, stdio: "ignore",
    });
    try {
      let statut = 0;
      for (let i = 0; i < 60 && statut !== 200; i++) {
        statut = await sonde("127.0.0.1");
        if (statut !== 200) await new Promise((r) => setTimeout(r, 500));
      }
      expect(statut).toBe(200);
      if (adresseLocale) expect(await sonde(adresseLocale)).toBe(0); // connexion refusée
    } finally {
      p.kill();
    }
  }, 60_000);
});
