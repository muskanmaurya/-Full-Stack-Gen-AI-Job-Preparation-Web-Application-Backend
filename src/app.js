import express from 'express';
import authRouter from './routes/auth.routes.js';
import cookieParser from "cookie-parser";
import cors from "cors";

//server initialize
const app = express();

//middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin:"http://localhost:5173",
    credentials:true
}))

//api route prefix
app.use("/api/auth",authRouter);





export default app;