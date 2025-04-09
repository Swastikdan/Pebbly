import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env"; 
const redis = new Redis({
  url: env.KV_REST_API_URL as string ,
  token: env.KV_REST_API_TOKEN as string ,
});

// Create a new ratelimiter that allows 5 requests per 5 seconds
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, "120 s"),
});

export { redis, ratelimit };
