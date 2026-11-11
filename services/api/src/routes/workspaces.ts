import { WorkspaceRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { createWorkspaceBodySchema } from "../schemas/workspaces";
import {
  assertWorkspaceMembership,
  createWorkspaceForUser,
  listWorkspaceMemberships,
} from "../services/workspace-service";
import { serializeWorkspace, serializeWorkspaceMembership } from "../utils/serializers";

export async function workspaceRoutes(app: FastifyInstance) {
  app.get(
    "/workspaces",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["workspaces"],
        summary: "List workspaces visible to the current user",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const memberships = await listWorkspaceMemberships(request.user.sub);

      return {
        workspaces: memberships.map(serializeWorkspaceMembership),
      };
    },
  );

  app.post(
    "/workspaces",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["workspaces"],
        summary: "Create a new personal or business workspace",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const body = createWorkspaceBodySchema.parse(request.body);

      const workspace = await prisma.$transaction((tx) =>
        createWorkspaceForUser(tx, {
          userId: request.user.sub,
          name: body.name,
          slug: body.slug,
          type: body.type,
          baseCurrency: body.baseCurrency,
        }),
      );

      return reply.code(201).send({
        workspace: serializeWorkspace(workspace),
        role: WorkspaceRole.OWNER,
      });
    },
  );

  app.get(
    "/workspaces/:workspaceId",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["workspaces"],
        summary: "Get a single workspace",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const workspaceId = (request.params as { workspaceId: string }).workspaceId;
      const membership = await assertWorkspaceMembership(request.user.sub, workspaceId);

      return {
        role: membership.role,
        workspace: serializeWorkspace(membership.workspace),
      };
    },
  );
}
