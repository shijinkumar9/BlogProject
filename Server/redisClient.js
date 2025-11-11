import { createClient } from 'redis';

function resolveRedisUrl() {
  if (process.env.REDIS_URL && process.env.REDIS_URL.trim()) {
    return process.env.REDIS_URL.trim();
  }

  if (process.env.REDIS_HOST) {
    const host = process.env.REDIS_HOST.trim();
    const port = (process.env.REDIS_PORT || '6379').trim();
    return `redis://${host}:${port}`;
  }

  if (process.env.DOCKER === 'true') {
    return 'redis://redis:6379';
  }

  return 'redis://127.0.0.1:6379';
}

const redisUrl = resolveRedisUrl();

const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) return new Error('Max retries');
      return Math.min(retries * 200, 2000);
    },
  },
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

async function connectWithRetry(maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (redisClient.isOpen) break;

    try {
      await redisClient.connect();
      console.log(`Redis connected → ${redisUrl.split('@')[1] || redisUrl}`);
      break;
    } catch (err) {
      console.warn(`Redis connect attempt ${attempt}/${maxAttempts} failed:`, err.message);

      if (attempt === maxAttempts) {
        console.warn('Redis unavailable – continuing in no-cache mode');
        break;
      }

      const backoff = 200 * attempt;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

await connectWithRetry();

export default redisClient;
// import { createClient } from 'redis';

// function resolveRedisUrl() {
//   if (process.env.REDIS_URL && process.env.REDIS_URL.trim().length > 0) {
//     return process.env.REDIS_URL;
//   }

//   if (process.env.REDIS_HOST) {
//     const host = process.env.REDIS_HOST.trim();
//     const port = (process.env.REDIS_PORT || '6379').trim();
//     return `redis://${host}:${port}`;
//   }

//   if (process.env.DOCKER === 'true') {
//     return 'redis://redis:6379';
//   }

//   return 'redis://127.0.0.1:6379';
// }

// const redisUrl = resolveRedisUrl();
// const redisClient = createClient({ url: redisUrl });

// redisClient.on('error', (err) => {
//   console.error('Redis Error:', err);
// });

// async function connectWithRetry(maxAttempts = 3) {
//   let attempt = 0;
//   while (attempt < maxAttempts && !redisClient.isOpen) {
//     attempt += 1;
//     try {
//       await redisClient.connect();
//       break;
//     } catch (error) {
//       if (attempt >= maxAttempts) {
//         console.warn(`Redis connect failed after ${attempt} attempts. Falling back to no-cache mode.`);
//         break;
//       }
//       const backoffMs = 200 * attempt;
//       await new Promise((r) => setTimeout(r, backoffMs));
//     }
//   }
// }

// await connectWithRetry();

// export default redisClient;
