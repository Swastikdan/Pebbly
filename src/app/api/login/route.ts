import  {type  NextRequest , NextResponse } from "next/server";
import { redis , ratelimit } from "@/redis";
import { nanoid } from "nanoid";
import {z} from "zod";

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
})
export async function POST( request : NextRequest){
     const ip = request.headers.get('x-forwarded-for')!
        // Enforce rate limiting per IP to prevent abuse (register/login spamming)
        const { success } = await ratelimit.limit(ip);
        if (!success) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }

        const { email , password } = await request.json();
        if (!email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        // write the validation logic here 

        const is_valid_email = registerSchema.safeParse(email).success
        if (!is_valid_email) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }
        const is_valid_password = registerSchema.safeParse(password).success
        if (!is_valid_password) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
        }
        const key = `user:${email}`;
        if (await redis.exists(key)) {
            return NextResponse.json({ error: 'User exists' }, { status: 400 });
          }
          const recoveryKey = nanoid(32);
  await redis.hmset(key, { password, recoveryKey });
  return NextResponse.json({ success: true, recoveryKey });

}