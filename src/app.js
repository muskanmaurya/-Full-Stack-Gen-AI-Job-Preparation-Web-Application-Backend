import express from 'express';
import authRouter from './routes/auth.routes.js';
import cookieParser from "cookie-parser";
import cors from "cors";
import interviewRouter from './routes/interview.routes.js';

//server initialize
const app = express();

//middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: "https://full-stack-gen-ai-job-preparation-w.vercel.app", // No trailing slash!
    credentials: true, // Allows the browser to send cookies
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

//api route prefix
app.use("/api/auth",authRouter);
app.use("/api/interview",interviewRouter);



export default app;