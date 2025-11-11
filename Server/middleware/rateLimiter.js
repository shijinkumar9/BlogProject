import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../redisClient.js';

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const max = Number(process.env.RATE_LIMIT_MAX || 100);

function buildStore() {
  if (redisClient?.isOpen) {
    try {
      return new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: 'rate-limit:',
      });
    } catch (err) {
      console.warn('RedisStore init failed:', err.message);
    }
  }
  console.info('Using in-memory rate limiting (Redis unavailable)');
  return undefined;
}

const limiter = rateLimit({
  windowMs,
  max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  store: buildStore(),
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ips.trim();
    }
    return req.ip || 'unknown';
  },
  skip: () => process.env.SKIP_RATE_LIMIT === 'true',
});

export default limiter;

// import rateLimit from 'express-rate-limit';
// import RedisStore from 'rate-limit-redis';
// import redisClient from '../redisClient.js';

// const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
// const max = Number(process.env.RATE_LIMIT_MAX || 100);

// function buildStore() {
//   if (redisClient && redisClient.isOpen) {
//     return new RedisStore({
//       sendCommand: (...args) => redisClient.sendCommand(args),
//     });
//   }
//   return undefined; // defaults to in-memory store
// }

// const limiter = rateLimit({
//   windowMs,
//   max,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: {
//     success: false,
//     message: 'Too many requests from this IP, please try again later.',
//   },
//   store: buildStore(),
//   keyGenerator: (req) => {
//     return (
//       req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
//       req.ip ||
//       req.connection?.remoteAddress ||
//       'unknown'
//     );
//   },
// });

// export default limiter;
