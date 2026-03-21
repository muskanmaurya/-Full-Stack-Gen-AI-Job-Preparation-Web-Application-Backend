import 'dotenv/config'; // MUST BE FIRST
import app from './src/app.js';
import connectToDB from './src/config/database.js';
// import invokeGeminiAi from './src/services/ai.service.js';
import {resume, selfDescription, jobDescription} from './src/services/temp.js'
import generateInterviewReport from './src/services/ai.service.js';

// Initialize database and AI service
(async () => {
  try {
    await connectToDB();
    console.log("Starting AI Test...");
    // await invokeGeminiAi();
    // await generateInterviewReport({resume, selfDescription, jobDescription});
  } catch (error) {
    console.error("Error during initialization:", error);
  }
})();

//app listen
app.listen(3000,(req,res)=>{
    console.log(`server is running on port 3000`);
})