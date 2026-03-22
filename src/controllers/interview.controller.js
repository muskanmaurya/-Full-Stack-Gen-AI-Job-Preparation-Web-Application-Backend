import { PDFParse } from "pdf-parse";
import generateInterviewReport from "../services/ai.service.js";
import interviewReportModel from "../models/interviewReport.model.js";

/**
 * @description controller to generate interview report on the basic of user self description, resume odf and job description
 */

export const generateInterviewReportController=async(req, res)=>{

    const resumeFile =req.file; // Access the uploaded file from multer

    const resumeContent = await (new PDFParse(Uint8Array.from(req.file.buffer))).getText();
    const {selfDescription, jobDescription} = req.body;

    const interviewReportByAi=await generateInterviewReport({
        resume:resumeContent.text,
        selfDescription,
        jobDescription
    })

    const interviewReport = await interviewReportModel.create({
        user:req.user.id,
        resume:resumeContent.text,
        selfDescription,
        jobDescription,
        ...interviewReportByAi
    })

    return res.status(201).json({
        message:"Interview report generated successfully",
        interviewReport
    })

}

/**
 * @description controller to get all interview reports by Id of the logged in user
 */

export const getInterviewReportByIdController=async(req,res)=>{
    const {interviewId}=req.params;

    const interviewReport = await interviewReportModel.findOne({_id:interviewId,user:req.user.id})

    if(!interviewReport){
        return res.status(404).json({
            message:"Interview report not found"
        })
    }

    return res.status(200).json({
        message:"Interview report fetched successfully",
        interviewReport
    })
}

/**
 * @description controller to get all interview reports of the logged in user      
 */

export const getAllInterviewReportsController=async(req,res) =>{
    const interviewReports=await interviewReportModel.find({user:req.user.id}).sort({createdAt:-1}).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps-preparationPlan")

    return res.status(200).json({
        message:"Interview reports fetched successfully",
    })
}