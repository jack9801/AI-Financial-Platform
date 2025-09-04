// src/index.ts
import "dotenv/config";
import "./config/passport.config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import passport from "passport";
import { Env } from "./config/env.config";
import { HTTPSTATUS } from "./config/http.config";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { BadRequestException } from "./utils/app-error";
import { asyncHandler } from "./middlewares/asyncHandler.middlerware";
import connctDatabase from "./config/database.config";
import authRoutes from "./routes/auth.route";
import { passportAuthenticateJwt } from "./config/passport.config";
import userRoutes from "./routes/user.route";
import transactionRoutes from "./routes/transaction.route";
import { initializeCrons } from "./cron";
import reportRoutes from "./routes/report.route";
import analyticsRoutes from "./routes/analytics.route";

const app = express();

/* ------------------ BASE_PATH (normalize /api) ------------------ */
let BASE_PATH = (Env.BASE_PATH || "").toString().trim();
if (BASE_PATH && /^https?:\/\//i.test(BASE_PATH)) {
  // If somebody set a full URL accidentally, extract pathname
  try {
    BASE_PATH = new URL(BASE_PATH).pathname || "";
  } catch {
    BASE_PATH = "";
  }
}
BASE_PATH = BASE_PATH.replace(/\/+$/, ""); // remove trailing slashes
if (BASE_PATH && !BASE_PATH.startsWith("/")) BASE_PATH = "/" + BASE_PATH;
if (BASE_PATH === "/") BASE_PATH = ""; // treat "/" as empty
/* --------------------------------------------------------------- */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

/* ---------------------- CORS (from Env.FRONTEND_ORIGIN) --------------------- */
// Example Env.FRONTEND_ORIGIN: "https://ai-financial-platform.vercel.app,http://localhost:5173"
const allowedOrigins = (Env.FRONTEND_ORIGIN || "")
  .split(",")
  .map(s => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser tools
      const normalized = origin.replace(/\/+$/, "");
      if (allowedOrigins.includes(normalized)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.options("*", cors());
/* -------------------------------------------------------------------------- */

app.get(
  "/",
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Original file threw a test error; keep as-is or comment out for prod
    // throw new BadRequestException("This is a test error");
    res.status(HTTPSTATUS.OK).json({
      message: "Hi welcome to AI Financial Platform API",
    });
  })
);

/* ------------------------ Mount routes with BASE_PATH ---------------------- */
app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, passportAuthenticateJwt, userRoutes);
app.use(`${BASE_PATH}/transaction`, passportAuthenticateJwt, transactionRoutes);
app.use(`${BASE_PATH}/report`, passportAuthenticateJwt, reportRoutes);
app.use(`${BASE_PATH}/analytics`, passportAuthenticateJwt, analyticsRoutes);
/* ------------------------------------------------------------------------- */

app.use(errorHandler);

app.listen(Env.PORT, async () => {
  await connctDatabase();

  if (Env.NODE_ENV === "development") {
    await initializeCrons();
  }

  console.log(`Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`);
});
