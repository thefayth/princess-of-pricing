import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Accounting Backend API",
        version: "0.1.0",
        description:
          "API for managing personal and business accounting workspaces from web and mobile clients.",
      },
      servers: [
        {
          url: env.API_PREFIX,
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: `${env.API_PREFIX}/docs`,
  });
}
