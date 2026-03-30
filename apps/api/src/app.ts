import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configFilesRouter } from "./routes/config-files-routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { containersRouter } from "./routes/containers-routes.js";
import { sendSuccess } from "./utils/api-response.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => sendSuccess(res, { status: "ok" }));
app.use("/api/containers", containersRouter);
app.use("/api/config-files", configFilesRouter);

if (process.env.NODE_ENV === "production") {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const webDistPath = path.resolve(currentDir, "../../web/dist");

  app.use(express.static(webDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webDistPath, "index.html"));
  });
}

app.use(errorHandler);
