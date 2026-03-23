import { PDFParse } from "pdf-parse";
import { generateInterviewReport,generateResumePdf } from "../services/ai.service.js";
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

    res.status(201).json({
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

    res.status(200).json({
        message:"Interview report fetched successfully",
        interviewReport
    })
}

/**
 * @description controller to get all interview reports of the logged in user      
 */

export const getAllInterviewReportsController=async(req,res) =>{
    const interviewReports=await interviewReportModel.find({user:req.user.id}).sort({createdAt:-1}).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps-preparationPlan")

    res.status(200).json({
        message:"Interview reports fetched successfully",
        interviewReports
    })
}

/**
 * @description controller to generate resume pdf based on user self description, resume and job description.
 */

export const generateResumePdfController=async(req,res)=>{
    const {interviewReportId}=req.params;

    const interviewReport=await interviewReportModel.findById(interviewReportId)

    if(!interviewReport){
        return res.status(404).json({
            message:"Interview report not found"
        })
    }

    const {resume,selfDescription,jobDescription}=interviewReport;

    const pdfBuffer = await generateResumePdf({resume, selfDescription, jobDescription})

    res.set({
        "content-Type": "application/pdf",
        "content-Disposition":`attachment;filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer);

}