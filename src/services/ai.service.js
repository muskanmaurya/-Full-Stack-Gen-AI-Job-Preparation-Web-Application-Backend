import {GoogleGenAI} from "@google/genai"
import {z} from "zod"
import { zodToJsonSchema } from "zod-to-json-schema";
import puppeteer from "puppeteer";


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
            tasks:z.array(z.string()).describe("List of tasks to be done on this day to prepare for the interview.")
        })).describe("A day-wise preparation plan for the candidate to follow in order to prepare effectively."),
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
    export async function generateInterviewReport({resume,selfDescription,jobDescription}){


        try {

        const prompt = `You are generating JSON for an interview report API.
    Return ONLY valid JSON. No markdown. No explanation. No extra keys.

    The output MUST match this exact schema and key names:
    {
      "title": string,
      "matchScore": number (0-100),
      "technicalQuestions": [{ "question": string, "intention": string, "answer": string }],
      "behavioralQuestions": [{ "question": string, "intention": string, "answer": string }],
      "skillGaps": [{ "skill": string, "severity": "low" | "medium" | "high" }],
      "preparationPlan": [{ "day": number, "focus": string, "tasks": string[] }]
    }

    Hard constraints:
    1. Include all keys exactly as above.
    2. Do not include keys like candidate_name, suitability_score, strengths, recommendation, gap_analysis, or any extra key.
    3. matchScore must be between 0 and 100.
    4. technicalQuestions must have exactly 5 items.
    5. behavioralQuestions must have exactly 5 items.
    6. skillGaps must have 4 to 8 items; severity only low/medium/high.
    7. preparationPlan must have 7 to 14 items.
    8. preparationPlan.day starts at 1 and increases sequentially by 1.
    9. Each preparationPlan item must include at least 2 tasks.
    10. Keep all strings non-empty and role-specific.

    Candidate details:
    Resume: ${resume}
    Self Description: ${selfDescription}
    Job Description: ${jobDescription}`

        //generating content with fuNction calling
        const response =  await ai.models.generateContent({
            model:"gemini-3-flash-preview",
            contents:prompt,
            config:{
                responseMimeType:"application/json",
                responseSchema:zodToJsonSchema(interviewReportSchema)
            }
        })
    
        console.log(JSON.parse(response.text)) 
        return JSON.parse(response.text);
    
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

        const pdfBuffer=await page.pdf({format:"A4"})

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
                    `

        const response = await ai.models.generateContent({
            model:"gemini-3-flash-preview",
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
