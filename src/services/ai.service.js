import {GoogleGenAI} from "@google/genai"
import {z} from "zod"
import { zodToJsonSchema } from "zod-to-json-schema";

//defining a zod schema for the interview report
const interviewReportSchema=z.object({
        matchScore:z.number().min(0).max(100).describe("A score between 0 and 100 indicating how well the candidate profile matches the job description."),
        technicalQuestions:z.array(z.object({
            question:z.string().describe("The technical questions that can be asked in the interview"),
            intentsion:z.string().describe("The intention of the interviewer behind asking this question"),
            answer:z.string().describe("How to answer this question, what points to cover, what approach to be taken etc.")
        })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
        behavioralQuestions:z.array(z.object({
            question:z.string().describe("The technical questions that can be asked in the interview"),
            intentsion:z.string().describe("The intention of the interviewer behind asking this question"),
            answer:z.string().describe("How to answer this question, what points to cover, what approach to be taken etc.")
        })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
        skillGaps:z.array(z.object({
            skill:z.string().describe("The skill which the candidate is lacking"),
            severity:z.enum(["low","medium","high"]).describe("The severity of this gap, i.e. how important is this skill for the job role"),
        })).describe("List of the skill gaps in the candidate's profile along with their severity"),
        preparationPlan:z.number().describe("The day number in the preparation plan, starting from 1. This will help the candidate to follow a structured preparation plan and stay on track."),
        focus:z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, behavioral questions etc."),
        tasks:z.array(z.string()).describe("List of tasks to be done on this day to prepare for the interview, e.g. solve 3 coding problems on arrays, read 2 system design articles, practice 5 behavioral questions etc."),
    }).describe("A day-wise preparaton plan for the candidate to follow inorder to prepare for the interview effectively")
    
    // Initialize AI after env vars are loaded
    // const ai = new GoogleGenAI({
    //   apiKey: process.env.GOOGLE_GENAI_API_KEY
    // });


    //generate interview report function
    async function generateInterviewReport({resume,selfDescription,jobDescription}){

        const apiKey = process.env.GOOGLE_GENAI_API_KEY;
        if (!apiKey) {
            throw new Error("GOOGLE_GENAI_API_KEY is missing. Add it in server/.env and restart the server.");
        }

        const ai = new GoogleGenAI({ apiKey });

        //using try catch block to handle any error
        try {

        const prompt = `
        Analyze the following candidate details against the job description.
        Resume: ${resume}
        Self Description: ${selfDescription}
        Job Description: ${jobDescription}
        Provide a highly detailed interview preparation report in JSON format.
        `;

        //generating content with fuction calling
        const response =  await ai.models.generateContent({
            model:"gemini-3.1-pro-preview",
            contents:prompt,
            config:{
                responseMimeType:"application/json",
                responseSchema:zodToJsonSchema(interviewReportSchema)
            }
        })
    
        // console.log(JSON.parse(response.text)) 
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

export default generateInterviewReport;


