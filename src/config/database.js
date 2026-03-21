import mongoose from "mongoose"

async function connectToDB(){

    try {
        
        await mongoose.connect(process.env.MONGO_URI)
    } catch (error) {
        console.log(error)
        
    }

    console.log("Connected to Database")
}

export default connectToDB;