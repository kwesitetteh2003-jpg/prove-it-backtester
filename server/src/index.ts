import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";
const staticDir = process.env.WEB_DIST ? resolve(process.env.WEB_DIST) : resolve(here, "../../web/dist");

const app = await buildApp({ staticDir, logger: true });
await app.listen({ port, host });
