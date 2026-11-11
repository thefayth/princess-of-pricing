import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { listWorkspaceMemberships } from "../services/workspace-service";
import { AppError } from "../utils/app-error";
import { serializeUser, serializeWorkspaceMembership } from "../utils/serializers";

export async function meRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["auth"],
        summary: "Return the current user profile and accessible workspaces",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
      });

      if (!user) {
        throw new AppError(404, "User not found");
      }

      const memberships = await listWorkspaceMemberships(user.id);

      return {
        user: serializeUser(user),
        workspaces: memberships.map(serializeWorkspaceMembership),
      };
    },
  );
}
