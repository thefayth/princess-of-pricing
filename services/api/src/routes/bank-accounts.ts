import { WorkspaceRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { createBankAccountBodySchema } from "../schemas/bank-accounts";
import { workspaceParamsSchema } from "../schemas/common";
import { assertWorkspaceMembership, assertWorkspaceRole } from "../services/workspace-service";
import { AppError } from "../utils/app-error";
import { serializeBankAccount } from "../utils/serializers";

export async function bankAccountRoutes(app: FastifyInstance) {
  app.get(
    "/workspaces/:workspaceId/bank-accounts",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["bank-accounts"],
        summary: "List bank accounts linked to a workspace",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params);
      await assertWorkspaceMembership(request.user.sub, workspaceId);

      const bankAccounts = await prisma.bankAccount.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
      });

      return {
        bankAccounts: bankAccounts.map(serializeBankAccount),
      };
    },
  );

  app.post(
    "/workspaces/:workspaceId/bank-accounts",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["bank-accounts"],
        summary: "Create a bank account mapping",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params);
      const body = createBankAccountBodySchema.parse(request.body);

      await assertWorkspaceRole(request.user.sub, workspaceId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
        WorkspaceRole.BOOKKEEPER,
      ]);

      const account = await prisma.account.findFirst({
        where: {
          id: body.accountId,
          workspaceId,
        },
      });

      if (!account) {
        throw new AppError(400, "The selected ledger account does not belong to this workspace");
      }

      const bankAccount = await prisma.bankAccount.create({
        data: {
          workspaceId,
          accountId: body.accountId,
          institutionName: body.institutionName,
          displayName: body.displayName,
          maskedNumber: body.maskedNumber,
          provider: body.provider,
        },
      });

      return reply.code(201).send({
        bankAccount: serializeBankAccount(bankAccount),
      });
    },
  );
}
