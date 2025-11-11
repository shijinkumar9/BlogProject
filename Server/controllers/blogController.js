import fs from 'fs';
import { promisify } from 'util';
import imagekit from '../configs/imageKit.js';
import Blog from '../models/Blog.js';
import Comment from '../models/Comment.js';
import main from '../configs/gemini.js';
import redisClient from '../redisClient.js';

const unlinkAsync = promisify(fs.unlink);

async function safeRedisDel(key) {
  try {
    if (redisClient?.isOpen) await redisClient.del(key);
  } catch (err) {
    console.warn(`Redis DEL failed [${key}]:`, err.message);
  }
}

async function safeRedisSetEx(key, ttl, value) {
  try {
    if (redisClient?.isOpen) await redisClient.setEx(key, ttl, value);
  } catch (err) {
    console.warn(`Redis SETEX failed [${key}]:`, err.message);
  }
}

async function safeRedisGet(key) {
  try {
    if (redisClient?.isOpen) return await redisClient.get(key);
  } catch (err) {
    console.warn(`Redis GET failed [${key}]:`, err.message);
  }
  return null;
}

// --- ADD BLOG ---
export const addBlog = async (req, res) => {
  let filePath = null;
  try {
    const { title, subTitle, description, category, isPublished } = JSON.parse(req.body.blog);
    const imageFile = req.file;

    if (!title || !description || !category || !imageFile) {
      return res.json({ success: false, message: "All fields are required" });
    }

    filePath = imageFile.path;
    const fileBuffer = fs.readFileSync(filePath);

    const response = await imagekit.upload({
      file: fileBuffer,
      fileName: imageFile.originalname,
      folder: '/blogs',
    });

    const optimizedImageUrl = imagekit.url({
      path: response.filePath,
      transformation: [{ quality: 'auto', format: 'webp', width: '1280' }],
    });

    const blog = await Blog.create({
      title, subTitle, description, category, image: optimizedImageUrl, isPublished,
    });

    await safeRedisDel('blogs:all');
    res.json({ success: true, message: "Blog added", blogId: blog._id });
  } catch (error) {
    res.json({ success: false, message: error.message });
  } finally {
    if (filePath) {
      try { await unlinkAsync(filePath); } catch (_) {}
    }
  }
};

// --- GET ALL BLOGS ---
export const getAllBlogs = async (req, res) => {
  try {
    const cacheKey = 'blogs:all';
    const cached = await safeRedisGet(cacheKey);

    if (cached) {
      return res.json({ success: true, blogs: JSON.parse(cached), fromCache: true });
    }

    const blogs = await Blog.find({ isPublished: true }).lean();
    await safeRedisSetEx(cacheKey, 3600, JSON.stringify(blogs));

    res.json({ success: true, blogs, fromCache: false });
  } catch (error) {
    console.error('getAllBlogs error:', error);
    res.json({ success: false, message: "Failed to fetch blogs" });
  }
};

// --- GET BLOG BY ID ---
export const getBlogById = async (req, res) => {
  try {
    const { blogId } = req.params;
    const cacheKey = `blog:${blogId}`;
    const cached = await safeRedisGet(cacheKey);

    if (cached) {
      return res.json({ success: true, blog: JSON.parse(cached), fromCache: true });
    }

    const blog = await Blog.findById(blogId).lean();
    if (!blog) return res.json({ success: false, message: "Blog not found" });

    await safeRedisSetEx(cacheKey, 3600, JSON.stringify(blog));
    res.json({ success: true, blog, fromCache: false });
  } catch (error) {
    res.json({ success: false, message: "Invalid ID or server error" });
  }
};

// --- DELETE BLOG ---
export const deleteBlogById = async (req, res) => {
  try {
    const { id } = req.body;
    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) return res.json({ success: false, message: "Blog not found" });

    await Comment.deleteMany({ blog: id });
    await safeRedisDel(`blog:${id}`);
    await safeRedisDel('blogs:all');

    res.json({ success: true, message: 'Blog deleted' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --- TOGGLE PUBLISH ---
export const togglePublish = async (req, res) => {
  try {
    const { id } = req.body;
    const blog = await Blog.findById(id);
    if (!blog) return res.json({ success: false, message: "Blog not found" });

    blog.isPublished = !blog.isPublished;
    await blog.save();

    await safeRedisDel(`blog:${id}`);
    await safeRedisDel('blogs:all');

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --- ADD COMMENT ---
export const addComment = async (req, res) => {
  try {
    const { blog, name, content } = req.body;
    if (!blog || !name || !content) {
      return res.json({ success: false, message: "All fields required" });
    }
    await Comment.create({ blog, name, content });
    res.json({ success: true, message: "Comment added for review" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --- GET COMMENTS ---
export const getBlogComments = async (req, res) => {
  try {
    const { blogId } = req.body;
    if (!blogId) return res.json({ success: false, message: "blogId required" });

    const comments = await Comment.find({ blog: blogId, isApproved: true })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, comments });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --- GENERATE CONTENT ---
export const generateContent = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) return res.json({ success: false, message: "Prompt required" });

    const content = await main(prompt + ' Generate a blog content for this topic in simple text format');
    res.json({ success: true, content });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// import fs from 'fs'
// import imagekit from '../configs/imageKit.js';
// import Blog from '../models/Blog.js';
// import Comment from '../models/Comment.js';
// import main from '../configs/gemini.js';
// import redisClient from '../redisClient.js';//redis import

// export const addBlog = async (req,res)=>{
//     try{
//         const {title,subTitle,description,category,isPublished} = JSON.parse(req.body.blog);
//         const imageFile = req.file;

//         //chech if all fields are present
//         if(!title ||!description || !category || !imageFile ){
//             return res.json({success:false,message:"All fields are required"})
//         }

//         const fileBuffer = fs.readFileSync(imageFile.path)

//         //Upload image to imagekit
//         const response = await imagekit.upload({
//             file: fileBuffer,
//             fileName: imageFile.originalname,
//             folder: '/blogs'
//         })

//         //optimization through imagekit URL transformation

//         const optimizedImageUrl = imagekit.url({
//             path : response.filePath,
//             transformation : [
//                 {
//                     quality : 'auto',// auto compression
//                     format : "webp",// convert to modern format
//                     width: '1280'// width resizing
//                 }
//             ]
//         });

//         const image = optimizedImageUrl;

//         await Blog.create({
//             title,
//             subTitle,
//             description,
//             category,
//             image,
//             isPublished
//         })

//         await redisClient.del('blogs:all');//redis cahing delete


//         res.json({success:true, message:"Blog added successfully"})
//     }catch(error){
//         res.json({success:false, message:error.message})
//     }
// }


// export const getAllBlogs = async (req, res) => {
//     try {
//         const cacheKey = 'blogs:all';
//         const cachedBlogs = await redisClient.get(cacheKey);

//         if (cachedBlogs) {
//             return res.json({ success: true, blogs: JSON.parse(cachedBlogs), fromCache: true });
//         }

//         const blogs = await Blog.find({ isPublished: true });
//         await redisClient.setEx(cacheKey, 3600, JSON.stringify(blogs)); // cache for 1 hour

//         res.json({ success: true, blogs, fromCache: false });
//     } catch (error) {
//         res.json({ success: false, message: error.message });
//     }
// }


// // export const getAllBlogs = async (req, res)=>{
// //     try{
// //         const blogs = await Blog.find({isPublished:true});
// //         res.json({success:true, blogs})
// //     }catch(error){
// //         res.json({success:false, message:error.message})
// //     }
// // }


// export const getBlogById = async (req, res) => {
//     try {
//         const { blogId } = req.params;

//         const cacheKey = `blog:${blogId}`;
//         const cachedBlog = await redisClient.get(cacheKey);

//         if (cachedBlog) {
//             return res.json({ success: true, blog: JSON.parse(cachedBlog), fromCache: true });
//         }

//         const blog = await Blog.findById(blogId);
//         if (!blog) {
//             return res.json({ success: false, message: "Blog not found" });
//         }

//         await redisClient.setEx(cacheKey, 3600, JSON.stringify(blog));
//         res.json({ success: true, blog, fromCache: false });
//     } catch (error) {
//         res.json({ success: false, message: error.message });
//     }
// }


// // export const getBlogById = async (req, res)=>{
// //     try{
// //         const {blogId} = req.params;
// //         const blog = await Blog.findById(blogId);
// //         if(!blog){
// //             return res.json({success:false, message:"Blog not found"})
// //         }
// //         res.json({success:true, blog})
// //     }catch(error){
// //         res.json({success:false, message:error.message})
// //     }
// // }

// export const deleteBlogById = async (req, res)=>{
//     try{
//         const {id} = req.body;
//         await Blog.findByIdAndDelete(id);

//         //delete all comments assocaited with blog

//         await Comment.deleteMany({blog:id});

//         await redisClient.del(`blog:${id}`);
//         await redisClient.del('blogs:all');
        
//         res.json({success:true,message:'Blog deleted Successfully'})
//     }catch(error){
//         res.json({success:false, message:error.message})
//     }
// }

// export const togglePublish = async (req, res)=>{
//     try{
//         const {id} = req.body;
//         const blog = await Blog.findById(id);
//         if(!blog){
//             return res.json({success:false, message:"Blog not found"})
//         }
//         blog.isPublished = !blog.isPublished;
//         await blog.save();

//         await redisClient.del(`blog:${id}`);
//         await redisClient.del('blogs:all');
        
//         res.json({success:true, message:'Blog Status Updated'})
//     }catch(error){
//         res.json({success:false, message:error.message})
//     }
// }

// export const addComment = async (req, res)=>{
//     try{
//         const {blog, name,content} = req.body;
//         await Comment.create({
//             blog,
//             name,
//             content
//         });
//         res.json({success:true, message:"Comment added for review"})

//     }catch(error){
//         res.json({success:false, message:error.message})
//     }
// }

// export const getBlogComments = async (req, res)=>{
//     try{
//         const {blogId} = req.body;
//         const comments = await Comment.find({blog:blogId,isApproved:true}).sort({createdAt:-1});
//         res.json({success:true, comments})
//     }catch(error){
//         res.json({success:false, message:error.message})
//     }
// }

// export const generateContent =async(req,res)=>{
//     try{
//         const {prompt} = req.body;
//         const content = await main(prompt + 'Generate a blog content for this topic in simple text format')
//         res.json({success:true,content})

//     }catch(e){
//         res.json({success:false,message:e.message})
//     }
// }