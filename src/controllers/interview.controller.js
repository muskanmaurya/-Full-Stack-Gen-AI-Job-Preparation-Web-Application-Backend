import { PDFParse } from "pdf-parse";
import { generateInterviewReport,generateResumePdf } from "../services/ai.service.js";
import interviewReportModel from "../models/interviewReport.model.js";

const guestInterviewReports = new Map();

const getGuestReportKey = (guestId, reportId) => `${guestId}::${reportId}`;

const getResumeText = async (resumeFile) => {
    if (!resumeFile) {
        return "";
    }

    const parsed = await (new PDFParse(Uint8Array.from(resumeFile.buffer))).getText();
    return parsed.text;
}

/**
 * @description controller to generate interview report on the basic of user self description, resume odf and job description
 */

export const generateInterviewReportController=async(req, res)=>{
    try {
        const resumeFile =req.file; // Access the uploaded file from multer
        const {selfDescription, jobDescription} = req.body;

        if (!jobDescription) {
            return res.status(400).json({
                message: "Job description is required"
            })
        }

        if (!resumeFile || !selfDescription) {
            return res.status(400).json({
                message: "Both resume and self description are required"
            })
        }

        const resumeText = await getResumeText(resumeFile);

        const interviewReportByAi=await generateInterviewReport({
            resume:resumeText,
            selfDescription,
            jobDescription
        })

        console.log("Generated Interview Report by AI:", interviewReportByAi);

        if (req.user?.isGuest) {
            const tempReportId = `guest-report-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const interviewReport = {
                _id: tempReportId,
                user: req.user.id,
                resume: resumeText,
                selfDescription,
                jobDescription,
                ...interviewReportByAi,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isGuest: true,
            }

            guestInterviewReports.set(getGuestReportKey(req.user.id, tempReportId), interviewReport);

            return res.status(201).json({
                message:"Temporary guest interview report generated successfully",
                interviewReport
            })
        }

        const interviewReport = await interviewReportModel.create({
            user:req.user.id,
            resume:resumeText,
            selfDescription,
            jobDescription,
            ...interviewReportByAi
        })


        return res.status(201).json({
            message:"Interview report generated successfully",
            interviewReport
        })
    } catch (error) {
        console.error("Error in generateInterviewReportController:", error?.message || error);

        const upstreamStatus = error?.status || error?.response?.status;
        if (upstreamStatus === 429) {
            return res.status(503).json({
                message: "AI service quota/rate limit reached. Please try again in a minute."
            })
        }

        if (upstreamStatus === 503) {
            return res.status(503).json({
                message: "AI service is temporarily unavailable. Please try again shortly."
            })
        }

        return res.status(500).json({
            message: "Failed to generate interview report"
        })
    }
}

/**
 * @description controller to get all interview reports by Id of the logged in user
 */

export const getInterviewReportByIdController=async(req,res)=>{
    const {interviewId}=req.params;

    if (req.user?.isGuest) {
        const interviewReport = guestInterviewReports.get(getGuestReportKey(req.user.id, interviewId));

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
    if (req.user?.isGuest) {
        const interviewReports = [...guestInterviewReports.entries()]
            .filter(([key]) => key.startsWith(`${req.user.id}::`))
            .map(([, report]) => ({
                _id: report._id,
                title: report.title,
                matchScore: report.matchScore,
                createdAt: report.createdAt,
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return res.status(200).json({
            message:"Interview reports fetched successfully",
            interviewReports
        })
    }

    const interviewReports=await interviewReportModel
        .find({user:req.user.id})
        .sort({createdAt:-1})
        .select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message:"Interview reports fetched successfully",
        interviewReports
    })
}

/**
 * @description controller to generate resume pdf based on user self description, resume and job description.
 */

export const generateResumePdfController=async(req,res)=>{
    try {
        const interviewReportId = req.params.interviewReportId || req.params.id;

        if (req.user?.isGuest) {
            const interviewReport = guestInterviewReports.get(getGuestReportKey(req.user.id, interviewReportId));
            const fallbackResume = req.body?.resume;
            const fallbackSelfDescription = req.body?.selfDescription;
            const fallbackJobDescription = req.body?.jobDescription;

            if (!interviewReport && (!fallbackResume || !fallbackSelfDescription || !fallbackJobDescription)) {
                return res.status(404).json({
                    message:"Guest interview report expired. Please regenerate the report before downloading resume."
                })
            }

            const resume = interviewReport?.resume || fallbackResume;
            const selfDescription = interviewReport?.selfDescription || fallbackSelfDescription;
            const jobDescription = interviewReport?.jobDescription || fallbackJobDescription;
            const pdfBuffer = await generateResumePdf({resume, selfDescription, jobDescription})

            res.set({
                "content-Type": "application/pdf",
                "content-Disposition":`attachment;filename=resume_${interviewReportId}.pdf`
            })

            return res.send(pdfBuffer);
        }

        const interviewReport=await interviewReportModel.findOne({_id:interviewReportId,user:req.user.id})

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
    } catch (error) {
        console.error("Error generating resume PDF:", error);
        res.status(500).json({
            message: "Failed to generate resume pdf. " + (error.message || "Unknown error")
        });
    }
}