import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (token.startsWith("popd_")) {
    const { createHash } = await import("node:crypto");
    const device = await prisma.popDevice.findFirst({ where: { tokenHash: createHash("sha256").update(token).digest("hex"), revokedAt: null, tokenExpiresAt: { gt: new Date() } }, include: { user: true } });
    if (!device) throw new AppError(401, "Device token is invalid or expired");
    const { workspaceId } = request.params as { workspaceId?: string };
    const isSyncRoute = request.method === "POST" && request.routeOptions.url === `${env.API_PREFIX}/workspaces/:workspaceId/pop/sync-events`;
    if (!isSyncRoute || workspaceId !== device.workspaceId) throw new AppError(403, "Device tokens can only sync their issued workspace");
    request.user = { sub: device.userId, email: device.user.email, fullName: device.user.fullName, devicePublicId: device.publicId };
    await prisma.popDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    return;
  }
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError(401, "Authentication required");
  }
}

export async function registerAuth(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  app.decorate("authenticate", authenticate);
}
