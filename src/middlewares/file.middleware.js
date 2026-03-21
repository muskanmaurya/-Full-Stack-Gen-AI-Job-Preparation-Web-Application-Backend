import multer from "multer";

const upload = multer({
    storage:multer.memoryStorage(),  //because we want to process the file in memory and not store it on disk
    limits:{
        fileSize:3*1024*1024 //3MB file size limit
    }
})

export default upload;