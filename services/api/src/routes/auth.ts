import { WorkspaceType } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { googleLoginBodySchema, loginBodySchema, registerBodySchema } from "../schemas/auth";
import { exchangeDevicePairingBodySchema } from "../schemas/pop";
import { createWorkspaceForUser, listWorkspaceMemberships } from "../services/workspace-service";
import { AppError } from "../utils/app-error";
import { hashPassword, verifyPassword } from "../utils/password";
import { serializeUser, serializeWorkspaceMembership } from "../utils/serializers";

function buildPersonalWorkspaceName(fullName: string) {
  const firstName = fullName.split(" ")[0] ?? "Owner";
  return `${firstName} Personal Books`;
}

type GoogleTokenInfo = { aud?: string; email?: string; email_verified?: string; iss?: string; name?: string };

async function verifiedGoogleIdentity(idToken: string) {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) throw new AppError(503, "Google sign-in is not configured");
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) throw new AppError(401, "Google sign-in could not be verified");
  const identity = await response.json() as GoogleTokenInfo;
  if (
    identity.aud !== env.GOOGLE_OAUTH_CLIENT_ID ||
    identity.email_verified !== "true" ||
    !identity.email ||
    !["accounts.google.com", "https://accounts.google.com"].includes(identity.iss ?? "")
  ) {
    throw new AppError(401, "Google sign-in could not be verified");
  }
  return { email: identity.email.toLowerCase(), fullName: identity.name ?? identity.email };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/device/exchange", { schema: { tags: ["auth"], summary: "Exchange a short-lived desktop pairing code" } }, async (request) => {
    const body = exchangeDevicePairingBodySchema.parse(request.body);
    const codeHash = createHash("sha256").update(body.code).digest("hex");
    const deviceToken = `popd_${randomBytes(32).toString("base64url")}`;
    const publicId = `desktop_${randomBytes(12).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const device = await prisma.$transaction(async (transaction) => {
      const pairing = await transaction.devicePairing.findFirst({ where: { codeHash, consumedAt: null, expiresAt: { gt: new Date() } } });
      if (!pairing) throw new AppError(401, "Pairing code is invalid or expired");
      const claimedAt = new Date();
      const claim = await transaction.devicePairing.updateMany({ where: { id: pairing.id, consumedAt: null, expiresAt: { gt: claimedAt } }, data: { consumedAt: claimedAt } });
      if (claim.count !== 1) throw new AppError(401, "Pairing code is invalid or expired");
      return transaction.popDevice.create({ data: { workspaceId: pairing.workspaceId, userId: pairing.userId, name: body.name, platform: body.platform, publicId, tokenHash: createHash("sha256").update(deviceToken).digest("hex"), tokenExpiresAt: expiresAt, lastSeenAt: new Date() } });
    });
    return { deviceToken, devicePublicId: device.publicId, workspaceId: device.workspaceId, expiresAt: expiresAt.toISOString() };
  });
  app.post(
    "/auth/register",
    {
      schema: {
        tags: ["auth"],
        summary: "Register a user and create starter workspaces",
      },
    },
    async (request, reply) => {
      if (env.POP_INVITE_ONLY) throw new AppError(403, "Registration requires a Prince of Pricing invite");
      const body = registerBodySchema.parse(request.body);
      const email = body.email.toLowerCase();
      const baseCurrency = body.baseCurrency.toUpperCase();

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new AppError(409, "An account with that email already exists");
      }

      const passwordHash = await hashPassword(body.password);

      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            fullName: body.fullName,
            phoneNumber: body.phoneNumber,
          },
        });

        await createWorkspaceForUser(tx, {
          userId: createdUser.id,
          name: buildPersonalWorkspaceName(body.fullName),
          type: WorkspaceType.PERSONAL,
          baseCurrency,
        });

        if (body.companyName) {
          await createWorkspaceForUser(tx, {
            userId: createdUser.id,
            name: body.companyName,
            type: WorkspaceType.BUSINESS,
            baseCurrency,
          });
        }

        return createdUser;
      });

      const memberships = await listWorkspaceMemberships(user.id);

      const token = await reply.jwtSign({
        sub: user.id,
        email: user.email,
        fullName: user.fullName,
      });

      return reply.code(201).send({
        token,
        user: serializeUser(user),
        workspaces: memberships.map(serializeWorkspaceMembership),
      });
    },
  );

  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["auth"],
        summary: "Log into the accounting backend",
      },
    },
    async (request) => {
      const body = loginBodySchema.parse(request.body);
      const email = body.email.toLowerCase();

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new AppError(401, "Invalid email or password");
      }

      const passwordMatches = await verifyPassword(body.password, user.passwordHash);

      if (!passwordMatches) {
        throw new AppError(401, "Invalid email or password");
      }

      const memberships = await listWorkspaceMemberships(user.id);
      const token = await app.jwt.sign({
        sub: user.id,
        email: user.email,
        fullName: user.fullName,
      });

      return {
        token,
        user: serializeUser(user),
        workspaces: memberships.map(serializeWorkspaceMembership),
      };
    },
  );

  app.post(
    "/auth/google",
    {
      schema: { tags: ["auth"], summary: "Sign in with a verified Google identity" },
    },
    async (request) => {
      const { idToken } = googleLoginBodySchema.parse(request.body);
      const identity = await verifiedGoogleIdentity(idToken);
      const user = await prisma.user.findUnique({ where: { email: identity.email } });
      if (!user) throw new AppError(403, "This Google account does not have a Prince of Pricing invite");

      const memberships = await listWorkspaceMemberships(user.id);
      const token = await app.jwt.sign({ sub: user.id, email: user.email, fullName: user.fullName });
      return { token, user: serializeUser(user), workspaces: memberships.map(serializeWorkspaceMembership) };
    },
  );
}
