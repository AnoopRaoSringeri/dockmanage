import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
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
app.use(errorHandler);
