import { type NextRequest, NextResponse } from "next/server";
import { redis, ratelimit } from "@/redis";
import { createJWT } from "@/lib/auth-helper";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")!;
  // Enforce rate limiting per IP to prevent abuse (register/login spamming)
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const { email, password } = await request.json();
  loginSchema.safeParse({ email, password });

  const user = await redis.hgetall(`user:${email}`);
  if (!user || user.password !== password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const token = await createJWT({ email });
  return NextResponse.json({ success: true, token });
}
