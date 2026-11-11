import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthTokenPayload } from "./auth";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

export {};
