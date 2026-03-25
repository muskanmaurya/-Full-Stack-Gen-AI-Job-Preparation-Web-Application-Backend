import 'dotenv/config'; // MUST BE FIRST
import app from './src/app.js';
import connectToDB from './src/config/database.js';


// Initialize database and AI service
(async () => {
  try {
    await connectToDB();
    console.log("Starting AI Test...");
  } catch (error) {
    console.error("Error during initialization:", error);
  }
})();

//app listen
app.listen(3000,(req,res)=>{
    console.log(`server is running on port 3000`);
})

app.get("/", (req, res) => res.send("API is running and ready for Vercel!"));