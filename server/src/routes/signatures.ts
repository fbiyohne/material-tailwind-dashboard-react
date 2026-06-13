import { Router } from "express";
import { z } from "zod";
import { asyncH } from "../middleware/error.js";
import { requireAuth } from "../middleware/auth.js";
import { verifierDocument } from "../lib/signature.js";

export const signaturesRouter = Router();
signaturesRouter.use(requireAuth);

const schema = z.object({ payload: z.string().min(1), signature: z.string().min(1) });

/** POST /signatures/verifier — vérifie l'authenticité d'un document signé. */
signaturesRouter.post(
  "/verifier",
  asyncH(async (req, res) => {
    const { payload, signature } = schema.parse(req.body);
    res.json({ valide: verifierDocument(payload, signature) });
  })
);
