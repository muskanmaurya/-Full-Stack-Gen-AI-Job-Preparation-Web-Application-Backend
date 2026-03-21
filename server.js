import app from './src/app.js';
import connectToDB from './src/config/database.js';
import dotenv from "dotenv";


dotenv.config();

connectToDB();

//app listen
app.listen(3000,(req,res)=>{
    console.log(`server is running on port 3000`);
})