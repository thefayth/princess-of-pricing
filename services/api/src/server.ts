import { env } from "./config/env";
import { buildApp } from "./app";

async function start() {
  const app = await buildApp();

  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
