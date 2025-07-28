import { createClient } from 'redis';

const redisClient = createClient({
  url: 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis Error:', err));
await redisClient.connect(); // Requires Node 14.8+ with top-level await

export default redisClient;
