import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "./migrate.js";

const defaultPath = path.resolve(process.cwd(), "data", "palavras-cruzadas.sqlite");
const databasePath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : defaultPath;

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const sqlite = new Database(databasePath);
migrate(sqlite);

export const db = drizzle(sqlite);
export { databasePath };
