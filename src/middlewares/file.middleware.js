import multer from "multer";

const upload = multer({
    storage:multer.memoryStorage(),  //because we want to process the file in memory and not store it on disk
    limits:{
        fileSize:5*1024*1024 //5MB file size limit to match frontend validation text
    }
})

export default upload;