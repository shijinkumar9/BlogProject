import jwt from "jsonwebtoken"

const auth = (req, res, next) => {
    const token = req.headers.authorization;//const token = req.headers.authorization?.split(" ")[1]; // Safe extract
    try{
        jwt.verify(token, process.env.JWT_SECRET)
        next();
    }catch(error){
        res.json({success:false,message: "Invalid Token"})
    }
}

export default auth