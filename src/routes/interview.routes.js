import express from "express";
import authUser from "../middlewares/auth.middleware.js";
import { generateInterviewReportController } from "../controllers/interview.controller.js";
import upload from "../middlewares/file.middleware.js"




const interviewRouter = express.Router();

/**
 * @route POST /api/interview/
 * @description generate new interview report on the basic of user self description, resume odf and job description
 * @access Private
 */

interviewRouter.post("/",authUser,upload.single("resume"),generateInterviewReportController)


export default interviewRouter;