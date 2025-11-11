// api/index.js
import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import connectDB from '../configs/db.js';
import adminRouter from '../routes/adminRoutes.js';
import blogRouter from '../routes/blogRoutes.js';
import limiter from '../middleware/rateLimiter.js'; // UNCOMMENTED

const app = express();

// ---------- DB ----------
await connectDB();

// ---------- Trust proxy ----------
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ---------- CORS ----------
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = isProd
  ? {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ---------- Body parser ----------
app.use(express.json());

// ---------- Global Rate Limiter (Redis-backed) ----------
app.use(limiter); // APPLY GLOBALLY

// ---------- Routes ----------
app.get('/', (req, res) => res.send('API is working'));

// Protect sensitive routes more strictly (optional)
app.use('/admin', adminRouter);     // e.g., 50 req/min
app.use('/blog', blogRouter);       // e.g., 100 req/15min (from env)

// Optional: Stricter limit on AI content generation
// app.use('/blog/generate', rateLimit({ windowMs: 60*1000, max: 5 }));

export default app;
// import express from 'express'
// import 'dotenv/config'
// import cors from 'cors'
// import connectDB from './configs/db.js'
// import adminRouter from './routes/adminRoutes.js';
// import blogRouter from './routes/blogRoutes.js';
// //import limiter from './middleware/rateLimiter.js';

// const app = express();
// await connectDB()

// // Trust proxy when behind load balancers/reverse proxies
// if (process.env.TRUST_PROXY === 'true') {
//     app.set('trust proxy', 1);
// }

// //Middleware
// const isProd = process.env.NODE_ENV === 'production';
// const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// const corsOptions = isProd
//     ? {
//         origin: (origin, callback) => {
//             if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
//                 return callback(null, true);
//             }
//             return callback(new Error('Not allowed by CORS'));
//         },
//         credentials: true
//       }
//     : {
//         origin: true, // reflect request origin in development
//         credentials: true
//       };

// app.use(cors(corsOptions))
// app.options('*', cors(corsOptions))
// app.use(express.json())
// //app.use(limiter)


// //Routes
// app.get('/', (req, res) => {
//     res.send('Api is working')
// })
// app.use('/api/admin', adminRouter)
// app.use('/api/blog',blogRouter)

// const PORT =process.env.PORT || 3000;

// app.listen(PORT,()=>{
//     console.log(`Server is running on port ${PORT}`)
// })

// export default app;

