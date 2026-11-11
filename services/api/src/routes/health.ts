import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Health check",
      },
    },
    async () => ({
      status: "ok",
      service: "accounting-backend",
      timestamp: new Date().toISOString(),
    }),
  );
}
