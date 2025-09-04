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
import { getDateRange } from "./utils/date";
import analyticsRoutes from "./routes/analytics.route";

const app = express();
const BASE_PATH = Env.BASE_PATH;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());

// build allowed origins from env or fallback to explicit list
const envOrigins = (Env.FRONTEND_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const HARD_CODED = [
  "https://ai-financial-platform-589zywku7-jack9801s-projects.vercel.app",
  "https://ai-financial-platform-git-main-jack9801s-projects.vercel.app",
  // you can add more here if needed
];

const allowedOrigins = Array.from(new Set(
  [...envOrigins, ...HARD_CODED]
    .map(o => o.replace(/\/+$/, "")) // remove trailing slashes
));

// debug middleware (optional but helpful while debugging on Render)
// logs the incoming Origin and whether it's allowed
app.use((req, res, next) => {
  const origin = (req.headers.origin || "").toString();
  const normalized = origin.replace(/\/+$/, "");
  console.log("[CORS] Origin:", origin, "Normalized:", normalized, "Allowed:", allowedOrigins.includes(normalized));
  next();
});

// Vary header so caches don't return wrong ACAO
app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser tools (curl, Postman) - they send no Origin
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/+$/, "");
    if (allowedOrigins.includes(normalized)) {
      // cb(null, true) tells cors to echo the requesting origin in ACAO
      return callback(null, true);
    }
    // explicitly deny: this results in no ACAO header for the browser (expected)
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"]
}));

// Ensure preflight requests are handled
app.options("*", cors());



app.get(
  "/",
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    throw new BadRequestException("This is a test error");
    res.status(HTTPSTATUS.OK).json({
      message: "Hi welcome to AI Financial Platform API",
    });
  })
);

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, passportAuthenticateJwt, userRoutes);
app.use(`${BASE_PATH}/transaction`, passportAuthenticateJwt, transactionRoutes);
app.use(`${BASE_PATH}/report`, passportAuthenticateJwt, reportRoutes);
app.use(`${BASE_PATH}/analytics`, passportAuthenticateJwt, analyticsRoutes);

app.use(errorHandler);

app.listen(Env.PORT, async () => {
  await connctDatabase();

  if (Env.NODE_ENV === "development") {
    await initializeCrons();
  }

  console.log(`Server is running on port ${Env.PORT} in ${Env.NODE_ENV} mode`);
});
