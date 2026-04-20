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

    const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
    const DEFAULT_PUPPETEER_ARGS = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
    ];

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const getLaunchConfigCandidates = () => {
        const executablePathFromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
        const executablePathFromPuppeteer = typeof puppeteer.executablePath === "function"
            ? puppeteer.executablePath()
            : undefined;

        const baseConfig = {
            headless: true,
            protocolTimeout: 120000,
            args: DEFAULT_PUPPETEER_ARGS,
        };

        const candidates = [baseConfig];

        if (executablePathFromEnv) {
            candidates.push({
                ...baseConfig,
                executablePath: executablePathFromEnv,
            });
        }

        if (executablePathFromPuppeteer) {
            candidates.push({
                ...baseConfig,
                executablePath: executablePathFromPuppeteer,
            });
        }

        return candidates;
    };

    const launchBrowserWithRetry = async () => {
        const configs = getLaunchConfigCandidates();
        let lastError;

        for (let i = 0; i < configs.length; i += 1) {
            try {
                return await puppeteer.launch(configs[i]);
            } catch (error) {
                lastError = error;
                console.error(`Puppeteer launch failed (config ${i + 1}/${configs.length}):`, error?.message || error);
            }
        }

        throw new Error(`Unable to launch Chromium for PDF generation. ${lastError?.message || "Unknown Puppeteer launch error"}`);
    };

    const getErrorStatus = (error) => error?.status || error?.response?.status;

    const isRetryableAiError = (error) => {
        const status = getErrorStatus(error);
        const code = error?.code;

        return RETRYABLE_STATUS_CODES.has(status) || code === "ETIMEDOUT" || code === "ECONNRESET";
    };

    const normalizeInterviewReport = (rawData) => ({
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
    });

    const buildFallbackInterviewReport = ({ selfDescription, jobDescription }) => {
        const baseTitle = (jobDescription || "").toLowerCase().includes("frontend")
            ? "Frontend Developer"
            : (jobDescription || "").toLowerCase().includes("backend")
                ? "Backend Developer"
                : "Software Engineer";

        return {
            title: baseTitle,
            matchScore: 65,
            technicalQuestions: [
                {
                    question: "Walk me through one project where you solved a challenging technical problem.",
                    intention: "Evaluate hands-on depth and problem-solving style.",
                    answer: "Explain context, constraints, your approach, trade-offs, and measurable result."
                },
                {
                    question: "How do you debug production issues systematically?",
                    intention: "Assess debugging framework and ownership mindset.",
                    answer: "Start with reproduction, isolate variables, inspect logs/metrics, validate hypothesis, and implement a monitored fix."
                },
                {
                    question: "How do you ensure code quality before deployment?",
                    intention: "Assess quality discipline and engineering maturity.",
                    answer: "Use testing, linting, PR review, staging checks, and post-deploy monitoring with rollback readiness."
                }
            ],
            behavioralQuestions: [
                {
                    question: "Tell me about a time you disagreed with a teammate on implementation details.",
                    intention: "Evaluate collaboration and conflict resolution.",
                    answer: "Use STAR format. Focus on listening, evidence-based decision making, and final team outcome."
                },
                {
                    question: "Describe a time you had to learn something quickly to deliver a task.",
                    intention: "Assess adaptability and learning speed.",
                    answer: "Describe the deadline, learning strategy, and how you validated understanding with delivery impact."
                }
            ],
            skillGaps: [
                { skill: "System design communication", severity: "medium" },
                { skill: "Behavioral storytelling with metrics", severity: "medium" }
            ],
            preparationPlan: [
                {
                    day: 1,
                    focus: "Role & Resume Alignment",
                    tasks: [
                        "Map your past projects to role requirements from the JD.",
                        "Prepare concise STAR stories with measurable outcomes."
                    ]
                },
                {
                    day: 2,
                    focus: "Core Technical Revision",
                    tasks: [
                        "Revise fundamentals and common interview patterns for your stack.",
                        "Practice explaining one end-to-end architecture decision."
                    ]
                },
                {
                    day: 3,
                    focus: "Mock Interview",
                    tasks: [
                        "Run one timed technical and one behavioral mock session.",
                        "Record weak areas and prepare improved second-pass answers."
                    ]
                }
            ],
            // Keep context short but useful for the UI and persistence.
            summary: `${selfDescription ? "Profile context captured" : "Limited profile context"} with fallback interview guidance due to temporary AI service issue.`
        };
    };

    const createInterviewPrompt = ({ resume, selfDescription, jobDescription }) => `You are generating interview preparation data for backend persistence.

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


    //generate interview report function
    export async function generateInterviewReport({resume, selfDescription, jobDescription}){
        const prompt = createInterviewPrompt({ resume, selfDescription, jobDescription });

        const maxAttempts = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: zodToJsonSchema(interviewReportSchema)
                    }
                });

                const rawData = JSON.parse(response.text);
                return normalizeInterviewReport(rawData);
            } catch (error) {
                lastError = error;
                const status = getErrorStatus(error);

                console.error(`Error in generateInterviewReport (attempt ${attempt}/${maxAttempts}):`, error?.message || error);
                console.error("AI interview generation error details:", {
                    status,
                    code: error?.code,
                    message: error?.message,
                });

                if (!isRetryableAiError(error) || attempt === maxAttempts) {
                    break;
                }

                const backoffMs = 750 * attempt;
                await sleep(backoffMs);
                console.warn(`Retrying AI generation after ${backoffMs}ms (status: ${status || "unknown"})`);
            }
        }

        // Return deterministic fallback instead of blocking users with a hard 503.
        console.warn("Using fallback interview report due to repeated AI service failures.", lastError?.message || lastError);
        return buildFallbackInterviewReport({ selfDescription, jobDescription });
    }

    export async function generatePdfFromHtml(htmlContent){
        let browser;

        try {
            if (!htmlContent || !String(htmlContent).trim()) {
                throw new Error("Cannot generate PDF: HTML content is empty");
            }

            browser = await launchBrowserWithRetry();

            const page = await browser.newPage();
            page.setDefaultTimeout(45000);
            await page.setContent(htmlContent, { waitUntil: "domcontentloaded", timeout: 45000 });
            await page.emulateMediaType("screen");

            const pdfBuffer = await page.pdf({
                format: "A4",
                printBackground: true,
                margin: { top: "15px", bottom: "15px", left: "10px", right: "10px" },
                preferCSSPageSize: true,
            });

            return pdfBuffer;
        } catch (error) {
            console.error("Resume PDF generation failed in Puppeteer:", {
                message: error?.message,
                code: error?.code,
                stack: error?.stack,
            });
            throw error;
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }

    const escapeHtml = (value = "") => String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const buildFallbackResumeHtml = ({ resume, selfDescription, jobDescription }) => {
        const resumeText = escapeHtml(resume || "");
        const selfText = escapeHtml(selfDescription || "");
        const jobText = escapeHtml(jobDescription || "");

        return `
            <html>
                <head>
                    <meta charset="utf-8" />
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            color: #1f2937;
                            margin: 32px;
                            line-height: 1.6;
                        }
                        h1 {
                            font-size: 26px;
                            margin-bottom: 8px;
                            color: #111827;
                        }
                        h2 {
                            font-size: 16px;
                            margin-top: 24px;
                            margin-bottom: 8px;
                            color: #0f172a;
                            border-bottom: 1px solid #e5e7eb;
                            padding-bottom: 4px;
                        }
                        .meta {
                            color: #4b5563;
                            font-size: 13px;
                            margin-bottom: 20px;
                        }
                        .section {
                            margin-bottom: 18px;
                        }
                        .text {
                            white-space: pre-wrap;
                            font-size: 13px;
                        }
                        .pill {
                            display: inline-block;
                            background: #e0f2fe;
                            color: #075985;
                            padding: 4px 10px;
                            border-radius: 999px;
                            font-size: 12px;
                            margin-bottom: 12px;
                        }
                    </style>
                </head>
                <body>
                    <div class="pill">Resume Summary</div>
                    <h1>Professional Resume</h1>
                    <div class="meta">Tailored for: ${jobText || "General Software Role"}</div>

                    <div class="section">
                        <h2>Self Description</h2>
                        <div class="text">${selfText || "No self description provided."}</div>
                    </div>

                    <div class="section">
                        <h2>Resume Content</h2>
                        <div class="text">${resumeText || "No resume text available."}</div>
                    </div>

                    <div class="section">
                        <h2>Job Description</h2>
                        <div class="text">${jobText || "No job description provided."}</div>
                    </div>
                </body>
            </html>
        `;
    };

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

        const maxAttempts = 2;
        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model:"gemini-2.5-flash",
                    contents:prompt,
                    config:{
                        responseMimeType:"application/json",
                        responseSchema:zodToJsonSchema(resumePdfSchema)
                    }
                })

                const jsonContent = JSON.parse(response.text);
                return await generatePdfFromHtml(jsonContent.html);
            } catch (error) {
                lastError = error;
                console.error(`Error in generateResumePdf (attempt ${attempt}/${maxAttempts}):`, error?.message || error);
                console.error("AI/HTML resume generation details:", {
                    status: getErrorStatus(error),
                    code: error?.code,
                    message: error?.message,
                });

                if (attempt < maxAttempts) {
                    await sleep(750 * attempt);
                }
            }
        }

        console.warn("Using fallback resume PDF HTML due to AI failure.", lastError?.message || lastError);
        const fallbackHtml = buildFallbackResumeHtml({ resume, selfDescription, jobDescription });
        try {
            return await generatePdfFromHtml(fallbackHtml);
        } catch (fallbackError) {
            console.error("Fallback resume PDF generation failed:", fallbackError?.message || fallbackError);
            throw new Error(`Resume PDF generation failed in Puppeteer: ${fallbackError?.message || "Unknown error"}`);
        }
    }
