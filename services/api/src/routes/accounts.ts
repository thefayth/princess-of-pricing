import { WorkspaceRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { createAccountBodySchema } from "../schemas/accounts";
import { workspaceParamsSchema } from "../schemas/common";
import { assertWorkspaceMembership, assertWorkspaceRole } from "../services/workspace-service";
import { serializeAccount } from "../utils/serializers";

export async function accountRoutes(app: FastifyInstance) {
  app.get(
    "/workspaces/:workspaceId/accounts",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["accounts"],
        summary: "List accounts in a workspace",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params);
      await assertWorkspaceMembership(request.user.sub, workspaceId);

      const accounts = await prisma.account.findMany({
        where: { workspaceId },
        include: { bankAccount: true },
        orderBy: { code: "asc" },
      });

      return {
        accounts: accounts.map(serializeAccount),
      };
    },
  );

  app.post(
    "/workspaces/:workspaceId/accounts",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["accounts"],
        summary: "Create an account inside a workspace",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params);
      const body = createAccountBodySchema.parse(request.body);

      await assertWorkspaceRole(request.user.sub, workspaceId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
        WorkspaceRole.BOOKKEEPER,
      ]);

      const account = await prisma.account.create({
        data: {
          workspaceId,
          code: body.code,
          name: body.name,
          type: body.type,
          subtype: body.subtype,
          currency: body.currency?.toUpperCase(),
        },
        include: { bankAccount: true },
      });

      return reply.code(201).send({
        account: serializeAccount(account),
      });
    },
  );
}
