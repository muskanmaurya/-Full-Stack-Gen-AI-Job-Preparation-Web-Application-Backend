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
    origin:process.env.NODE_BASE_API_URL,
    credentials:true
}))

//api route prefix
app.use("/api/auth",authRouter);
app.use("/api/interview",interviewRouter);



export default app;