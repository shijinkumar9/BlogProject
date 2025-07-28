import fs from 'fs'
import imagekit from '../configs/imageKit.js';
import Blog from '../models/Blog.js';
import Comment from '../models/Comment.js';
import main from '../configs/gemini.js';
import redisClient from '../redisClient.js';//redis import

export const addBlog = async (req,res)=>{
    try{
        const {title,subTitle,description,category,isPublished} = JSON.parse(req.body.blog);
        const imageFile = req.file;

        //chech if all fields are present
        if(!title ||!description || !category || !imageFile ){
            return res.json({success:false,message:"All fields are required"})
        }

        const fileBuffer = fs.readFileSync(imageFile.path)

        //Upload image to imagekit
        const response = await imagekit.upload({
            file: fileBuffer,
            fileName: imageFile.originalname,
            folder: '/blogs'
        })

        //optimization through imagekit URL transformation

        const optimizedImageUrl = imagekit.url({
            path : response.filePath,
            transformation : [
                {
                    quality : 'auto',// auto compression
                    format : "webp",// convert to modern format
                    width: '1280'// width resizing
                }
            ]
        });

        const image = optimizedImageUrl;

        await Blog.create({
            title,
            subTitle,
            description,
            category,
            image,
            isPublished
        })

        await redisClient.del('blogs:all');//redis cahing delete


        res.json({success:true, message:"Blog added successfully"})
    }catch(error){
        res.json({success:false, message:error.message})
    }
}


export const getAllBlogs = async (req, res) => {
    try {
        const cacheKey = 'blogs:all';
        const cachedBlogs = await redisClient.get(cacheKey);

        if (cachedBlogs) {
            return res.json({ success: true, blogs: JSON.parse(cachedBlogs), fromCache: true });
        }

        const blogs = await Blog.find({ isPublished: true });
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(blogs)); // cache for 1 hour

        res.json({ success: true, blogs, fromCache: false });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}


// export const getAllBlogs = async (req, res)=>{
//     try{
//         const blogs = await Blog.find({isPublished:true});
//         res.json({success:true, blogs})
//     }catch(error){
//         res.json({success:false, message:error.message})
//     }
// }


export const getBlogById = async (req, res) => {
    try {
        const { blogId } = req.params;

        const cacheKey = `blog:${blogId}`;
        const cachedBlog = await redisClient.get(cacheKey);

        if (cachedBlog) {
            return res.json({ success: true, blog: JSON.parse(cachedBlog), fromCache: true });
        }

        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.json({ success: false, message: "Blog not found" });
        }

        await redisClient.setEx(cacheKey, 3600, JSON.stringify(blog));
        res.json({ success: true, blog, fromCache: false });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}


// export const getBlogById = async (req, res)=>{
//     try{
//         const {blogId} = req.params;
//         const blog = await Blog.findById(blogId);
//         if(!blog){
//             return res.json({success:false, message:"Blog not found"})
//         }
//         res.json({success:true, blog})
//     }catch(error){
//         res.json({success:false, message:error.message})
//     }
// }

export const deleteBlogById = async (req, res)=>{
    try{
        const {id} = req.body;
        await Blog.findByIdAndDelete(id);

        //delete all comments assocaited with blog

        await Comment.deleteMany({blog:id});

        await redisClient.del(`blog:${id}`);
        await redisClient.del('blogs:all');
        
        res.json({success:true,message:'Blog deleted Successfully'})
    }catch(error){
        res.json({success:false, message:error.message})
    }
}

export const togglePublish = async (req, res)=>{
    try{
        const {id} = req.body;
        const blog = await Blog.findById(id);
        if(!blog){
            return res.json({success:false, message:"Blog not found"})
        }
        blog.isPublished = !blog.isPublished;
        await blog.save();

        await redisClient.del(`blog:${id}`);
        await redisClient.del('blogs:all');
        
        res.json({success:true, message:'Blog Status Updated'})
    }catch(error){
        res.json({success:false, message:error.message})
    }
}

export const addComment = async (req, res)=>{
    try{
        const {blog, name,content} = req.body;
        await Comment.create({
            blog,
            name,
            content
        });
        res.json({success:true, message:"Comment added for review"})

    }catch(error){
        res.json({success:false, message:error.message})
    }
}

export const getBlogComments = async (req, res)=>{
    try{
        const {blogId} = req.body;
        const comments = await Comment.find({blog:blogId,isApproved:true}).sort({createdAt:-1});
        res.json({success:true, comments})
    }catch(error){
        res.json({success:false, message:error.message})
    }
}

export const generateContent =async(req,res)=>{
    try{
        const {prompt} = req.body;
        const content = await main(prompt + 'Generate a blog content for this topic in simple text format')
        res.json({success:true,content})

    }catch(e){
        res.json({success:false,message:e.message})
    }
}