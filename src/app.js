import express from 'express';
import authRouter from './routes/auth.routes.js';
import cookieParser from "cookie-parser";
import cors from "cors";
import interviewRouter from './routes/interview.routes.js';

//server initialize
const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
    "https://full-stack-gen-ai-job-preparation-w.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
];

const ENV_ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const ALLOWED_ORIGINS = new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...ENV_ALLOWED_ORIGINS,
]);

//middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.has(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-guest-token"] 
}));

//api route prefix
app.use("/api/auth",authRouter);
app.use("/api/interview",interviewRouter);



export default app;