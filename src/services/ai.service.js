import {GoogleGenAI} from "@google/genai"
import {z} from "zod"
import { zodToJsonSchema } from "zod-to-json-schema";
import puppeteer from "puppeteer";
import interviewReportModel from "../models/interviewReport.model.js"


//defining a zod schema for the interview report
const interviewReportSchema=z.object({
        matchScore:z.number().min(0).max(100).describe("A score between 0 and 100 indicating how well the candidate profile matches the job description."),
        technicalQuestions:z.array(z.object({
            question:z.string().describe("The technical questions that can be asked in the interview"),
            intention:z.string().describe("The intention of the interviewer behind asking this question"),
            answer:z.string().describe("How to answer this question, what points to cover, what approach to be taken etc.")
        })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
        behavioralQuestions:z.array(z.object({
            question:z.string().describe("The technical questions that can be asked in the interview"),
            intention:z.string().describe("The intention of the interviewer behind asking this question"),
            answer:z.string().describe("How to answer this question, what points to cover, what approach to be taken etc.")
        })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
        skillGaps:z.array(z.object({
            skill:z.string().describe("The skill which the candidate is lacking"),
            severity:z.enum(["low","medium","high"]).describe("The severity of this gap, i.e. how important is this skill for the job role"),
        })).describe("List of the skill gaps in the candidate's profile along with their severity"),
        preparationPlan:z.array(z.object({
            day:z.number().int().positive().describe("The day number in the preparation plan, starting from 1."),
            focus:z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, behavioral questions etc."),
            tasks:z.array(z.string()).min(2).describe("List of tasks to be done on this day to prepare for the interview.")
        })).max(10).describe("A day-wise preparation plan for the candidate to follow in order to prepare effectively. It can also be empty for highly job-ready candidates."),
        title:z.string().describe("A short role title inferred from the job description.")
    }).describe("A day-wise preparaton plan for the candidate to follow inorder to prepare for the interview effectively")
    
    // Initialize AI after env vars are loaded
    // const ai = new GoogleGenAI({
    //   apiKey: process.env.GOOGLE_GENAI_API_KEY
    // });

    // Function to initialize the GoogleGenAI instance
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_GENAI_API_KEY is missing. Add it in server/.env and restart the server.");
    }

    // Create a single instance of GoogleGenAI to be used across the application
    const ai = new GoogleGenAI({ apiKey });


    //generate interview report function
    export async function generateInterviewReport({resume, selfDescription, jobDescription}){
    try {
                const prompt = `You are generating interview preparation data for backend persistence.

                Even if the user provides a one-line description, "N/A", or minimal input, you MUST generate a complete and high-quality response. If the Job Description is missing or insufficient, analyze the Resume to predict the most likely roles and provide technical/behavioral questions, skill gaps, and a preparation plan based on the candidate's professional background alone. Your response should never fail and must always follow the required structure.

                Return ONLY valid JSON (no markdown, no explanation, no code fences).
                Match this schema exactly:
        {
          "title": "string",
          "matchScore": number,
          "technicalQuestions": [{"question": "string", "intention": "string", "answer": "string"}],
          "behavioralQuestions": [{"question": "string", "intention": "string", "answer": "string"}],
          "skillGaps": [{"skill": "string", "severity": "low"|"medium"|"high"}],
          "preparationPlan": [{"day": number, "focus": "string", "tasks": ["string"]}]
        }

                Rules:
                - Use object arrays only. Never output flattened tokens like ["question", "..."] or ["day", "1", "focus", ...].
                - Ensure every question item has question, intention, answer.
                - Ensure every skill gap item has skill and severity.
                - Ensure preparationPlan has 0 to 4/5 days.
                - If the candidate is already highly prepared, it is valid to return an empty preparationPlan.
                - If preparationPlan is non-empty, ensure it is ordered by day starting at 1 with no gaps (1,2,3...).
                - Ensure every preparationPlan day has a short, specific focus title (e.g. "System Design & Architecture").
                - Ensure each day includes at least 2 concrete tasks, task strings only.
                - Keep output concise and realistic for interview preparation.
        
        Data: ${selfDescription}
        Resume: ${resume}
        JD: ${jobDescription}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Stable model for 2026
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(interviewReportSchema)
            }
        });

        console.log("response.text: ",response.text);

        const jsonContent = JSON.parse(response.text);
        console.log(jsonContent);

        const rawData = JSON.parse(response.text);

        console.log("rawData: ", rawData);

        // FORCE MAPPING: This prevents the Mongoose "got false" error 
        // by ensuring every string becomes an object before it hits the DB.
        return {
            title: rawData.title || "Software Engineer",
            matchScore: rawData.matchScore || 0,
            technicalQuestions: (rawData.technicalQuestions || []).map(q => ({
                question: typeof q === 'string' ? q : q.question,
                intention: q.intention || "Assess technical skill",
                answer: q.answer || "Standard industry approach"
            })),
            behavioralQuestions: (rawData.behavioralQuestions || []).map(q => ({
                question: typeof q === 'string' ? q : q.question,
                intention: q.intention || "Assess soft skills",
                answer: q.answer || "Use STAR method"
            })),
            skillGaps: (rawData.skillGaps || []).map(s => ({
                skill: typeof s === 'string' ? s : s.skill,
                severity: s.severity || "medium"
            })),
            preparationPlan: (rawData.preparationPlan || []).map((p, i) => ({
                day: p.day || i + 1,
                focus: p.focus || "Interview Prep",
                tasks: Array.isArray(p.tasks) ? p.tasks : [String(p)]
            }))
        };
    }catch (error) {
    if (error.status === 429) {
      console.error("RATE LIMIT: Free tier exhausted. Wait 60s.");
    } else {
      console.error("Error in generateInterviewReport:", error.message || error);
    }
    throw error; // Re-throw so your controller can handle it
  }
    }

    export async function generatePdfFromHtml(htmlContent){
        const browser=await puppeteer.launch();
        const page=await browser.newPage();
        await page.setContent(htmlContent,{waitUntil:"networkidle0"})

        const pdfBuffer=await page.pdf({format:"A4",margin : { top: "15px", bottom: "15px", left: "10px", right: "10px"}})

        await browser.close();

        return pdfBuffer;
    }

    export async function generateResumePdf({resume, selfDescription, jobDescription}){
        const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
        })

        const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                        Do not wrap the resume in a card/container with gray background, border, shadow, or rounded corners.
                        Keep the layout print-safe and simple for A4 pages, and avoid fixed viewport heights that break pagination.
                    `

        const response = await ai.models.generateContent({
            model:"gemini-2.5-flash",
            contents:prompt,
            config:{
                responseMimeType:"application/json",
                responseSchema:zodToJsonSchema(resumePdfSchema)
            }
        }) 
        
        const jsonContent= JSON.parse(response.text)

        const pdfBuffer = await generatePdfFromHtml(jsonContent.html);

        return pdfBuffer;
    }
