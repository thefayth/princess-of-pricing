import cors from "@fastify/cors";
import { Prisma } from "@prisma/client";
import Fastify from "fastify";
import { ZodError } from "zod";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { registerAuth } from "./plugins/auth";
import { registerSwagger } from "./plugins/swagger";
import { accountRoutes } from "./routes/accounts";
import { authRoutes } from "./routes/auth";
import { bankAccountRoutes } from "./routes/bank-accounts";
import { healthRoutes } from "./routes/health";
import { journalEntryRoutes } from "./routes/journal-entries";
import { meRoutes } from "./routes/me";
import { popRoutes } from "./routes/pop";
import { reportRoutes } from "./routes/reports";
import { workspaceRoutes } from "./routes/workspaces";
import { AppError } from "./utils/app-error";

function buildCorsOrigins() {
  const origins = env.CORS_ORIGIN.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : ["*"];
}

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const allowedOrigins = buildCorsOrigins();

  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"), false);
    },
  });

  await registerAuth(app);
  await registerSwagger(app);

  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Request validation failed",
        details: error.flatten(),
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.name,
        message: error.message,
        details: error.details ?? null,
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return reply.status(409).send({
          error: "ConflictError",
          message: "A record with that value already exists",
          details: error.meta ?? null,
        });
      }

      if (error.code === "P2025") {
        return reply.status(404).send({
          error: "NotFoundError",
          message: "The requested record does not exist",
          details: error.meta ?? null,
        });
      }
    }

    app.log.error(error);

    return reply.status(500).send({
      error: "InternalServerError",
      message: "An unexpected error occurred",
    });
  });

  await app.register(healthRoutes, { prefix: env.API_PREFIX });
  await app.register(authRoutes, { prefix: env.API_PREFIX });
  await app.register(meRoutes, { prefix: env.API_PREFIX });
  await app.register(popRoutes, { prefix: env.API_PREFIX });
  await app.register(workspaceRoutes, { prefix: env.API_PREFIX });
  await app.register(accountRoutes, { prefix: env.API_PREFIX });
  await app.register(bankAccountRoutes, { prefix: env.API_PREFIX });
  await app.register(journalEntryRoutes, { prefix: env.API_PREFIX });
  await app.register(reportRoutes, { prefix: env.API_PREFIX });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}
