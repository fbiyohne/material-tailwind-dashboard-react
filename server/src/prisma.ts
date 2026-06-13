import { PrismaClient } from "@prisma/client";

/** Client Prisma partagé (singleton). */
export const prisma = new PrismaClient();
