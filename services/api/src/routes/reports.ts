import type { FastifyInstance } from "fastify";
import { trialBalanceQuerySchema } from "../schemas/journal-entries";
import { workspaceParamsSchema } from "../schemas/common";
import { buildTrialBalance } from "../services/report-service";
import { assertWorkspaceMembership } from "../services/workspace-service";

export async function reportRoutes(app: FastifyInstance) {
  app.get(
    "/workspaces/:workspaceId/reports/trial-balance",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["reports"],
        summary: "Generate a trial balance for a workspace",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const { workspaceId } = workspaceParamsSchema.parse(request.params);
      const query = trialBalanceQuerySchema.parse(request.query);

      await assertWorkspaceMembership(request.user.sub, workspaceId);

      return buildTrialBalance(workspaceId, query.asOf, query.includeZeroBalance);
    },
  );
}
