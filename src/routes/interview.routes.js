import express from "express";
import authUser from "../middlewares/auth.middleware.js";
import { generateInterviewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController } from "../controllers/interview.controller.js";
import upload from "../middlewares/file.middleware.js"




const interviewRouter = express.Router();

/**
 * @route POST /api/interview/
 * @description generate new interview report on the basic of user self description, resume odf and job description
 * @access Private
 */

interviewRouter.post("/",authUser,upload.single("resume"),generateInterviewReportController)

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interview id
 * @access Private
 */

interviewRouter.get("/report/:interviewId",authUser,getInterviewReportByIdController)

/**
 * @route GET /api/interview/
 * @description get all interview reports of the logged in user
 * @access Private
 */

interviewRouter.get("/",authUser,getAllInterviewReportsController)

/**
 * @route POST /api/interview/resume/pdf
 * @description generate resume pdf on the basis of user self description, resume content and job description.
 * @access private
 */

interviewRouter.post("/resume/pdf/:interviewReportId",authUser,generateResumePdfController)

export default interviewRouter;