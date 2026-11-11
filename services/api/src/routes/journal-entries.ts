import { EntryStatus, WorkspaceRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import {
  createJournalEntryBodySchema,
  listJournalEntriesQuerySchema,
} from "../schemas/journal-entries";
import { workspaceParamsSchema } from "../schemas/common";
import { createJournalEntry } from "../services/journal-entry-service";
import { assertWorkspaceMembership, assertWorkspaceRole } from "../services/workspace-service";
import { endOfISODate, parseISODate } from "../utils/date";
import { serializeJournalEntry } from "../utils/serializers";

export async function journalEntryRoutes(app: FastifyInstance) {
  app.get(
    "/workspaces/:workspaceId/journal-entries",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["journal-entries"],
        summary: "List journal entries in a workspace",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params);
      const query = listJournalEntriesQuerySchema.parse(request.query);

      await assertWorkspaceMembership(request.user.sub, workspaceId);

      const entries = await prisma.journalEntry.findMany({
        where: {
          workspaceId,
          ...(query.status ? { status: query.status } : {}),
          ...(query.dateFrom || query.dateTo
            ? {
                entryDate: {
                  ...(query.dateFrom ? { gte: parseISODate(query.dateFrom) } : {}),
                  ...(query.dateTo ? { lte: endOfISODate(query.dateTo) } : {}),
                },
              }
            : {}),
        },
        take: query.limit,
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        include: {
          createdBy: true,
          lines: {
            include: {
              account: true,
              counterparty: true,
            },
          },
        },
      });

      return {
        entries: entries.map(serializeJournalEntry),
      };
    },
  );

  app.post(
    "/workspaces/:workspaceId/journal-entries",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["journal-entries"],
        summary: "Create a balanced journal entry",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params);
      const body = createJournalEntryBodySchema.parse(request.body);

      await assertWorkspaceRole(request.user.sub, workspaceId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.ADMIN,
        WorkspaceRole.BOOKKEEPER,
      ]);

      const entry = await prisma.$transaction((tx) =>
        createJournalEntry(tx, {
          workspaceId,
          createdById: request.user.sub,
          reference: body.reference,
          memo: body.memo,
          entryDate: body.entryDate,
          status: body.status as EntryStatus,
          source: body.source,
          lines: body.lines,
        }),
      );

      return reply.code(201).send({
        entry: serializeJournalEntry(entry),
      });
    },
  );
}
