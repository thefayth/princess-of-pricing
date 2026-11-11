import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

export function requireIdempotencyKey(headers: Record<string, unknown>) {
  const value = headers["idempotency-key"];
  if (typeof value !== "string" || value.trim().length < 8 || value.length > 200) {
    throw new AppError(400, "A valid Idempotency-Key header is required");
  }
  return value.trim();
}

type StoredResponse = {
  statusCode: number;
  response: Record<string, unknown>;
};

export async function replayIdempotency(workspaceId: string, key: string, operation: string): Promise<StoredResponse | null> {
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { workspaceId_key_operation: { workspaceId, key, operation } },
  });
  return existing ? { statusCode: existing.statusCode, response: existing.response as Record<string, unknown> } : null;
}

export async function withIdempotency(
  workspaceId: string,
  key: string,
  operation: string,
  run: () => Promise<StoredResponse>,
): Promise<StoredResponse> {
  const existing = await replayIdempotency(workspaceId, key, operation);
  if (existing) return existing;

  const result = await run();
  const response = JSON.parse(JSON.stringify(result.response)) as Prisma.InputJsonObject;
  await prisma.idempotencyRecord.create({
    data: {
      workspaceId,
      key,
      operation,
      statusCode: result.statusCode,
      response,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return result;
}
