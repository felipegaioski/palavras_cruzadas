import { buildApp } from "./app.js";
import { databasePath } from "./db/client.js";

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

try {
  await app.listen({ host: "127.0.0.1", port });
  app.log.info(`Banco de dados: ${databasePath}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
