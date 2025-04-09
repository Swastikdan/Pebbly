// import { type NextRequest, NextResponse } from 'next/server'
// import { redis, ratelimit } from '@/redis'
// import { nanoid } from 'nanoid'
// import bcrypt from 'bcryptjs'
// import jwt from 'jsonwebtoken'
// import { env } from '@/env'

// /**
//  * List of popular email domains used for basic email domain validation.
//  * Helps reduce bots and disposable email usage.
//  */
// const POPULAR_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']

// /**
//  * Validates an email address structure and ensures it belongs to a popular domain.
//  * @param email - Email address to validate
//  * @returns boolean indicating whether the email is valid and allowed
//  */
// const isValidEmail = (email: string): boolean => {
//   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
//   if (!emailRegex.test(email)) return false

//   const domain = email.split('@')[1]?.toLowerCase() ?? ''
//   return POPULAR_DOMAINS.includes(domain)
// }

// /**
//  * Handles user registration and login actions.
//  * Uses Redis for temporary user storage and JWT for session tokens.
//  * Rate limiting is enforced to protect against abuse (e.g., brute force).
//  */
// export async function POST(request: NextRequest) {
//   const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'

//   // Enforce rate limiting per IP to prevent abuse (register/login spamming)
//   const { success } = await ratelimit.limit(ip)
//   if (!success) {
//     return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
//   }

//   try {
//     // Safely parse the request body and narrow the type
//     const body = await request.json() as {
//       action: string;
//       email: string;
//       password: string;
//     }

//     const { action, email, password } = body

//     // Basic input validation
//     if (!email || !password || !action) {
//       return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
//     }

//     // Only allow known popular email domains to prevent disposable email abuse
//     if (!isValidEmail(email)) {
//       return NextResponse.json({ error: 'Invalid or unsupported email domain' }, { status: 400 })
//     }

//     /**
//      * Handle user registration:
//      * - Hash password with bcrypt
//      * - Store user data in Redis (both ID-based and email-based keys for lookup)
//      */
//     if (action === 'register') {
//       const userId = nanoid()
//       // check if userId is already in use with email
//       const userIdInUse = await redis.get(`user:${email}`)
//       if (userIdInUse) {
//         return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
//       }
//       const hashedPassword = await bcrypt.hash(password, 10)

//       await redis.set(`user:${userId}`, JSON.stringify({ email, password: hashedPassword }))
//       await redis.set(`user:${email}`, userId)

//       return NextResponse.json({ message: 'User registered successfully' }, { status: 200 })

//     /**
//      * Handle user login:
//      * - Lookup userId by email
//      * - Validate password
//      * - Return signed JWT token (valid for 30 days)
//      */
//     } else if (action === 'login') {
//       const userId = await redis.get(`user:${email}`)
//       if (!userId || typeof userId !== 'string') {
//         return NextResponse.json({ error: 'Invalid email or password one' }, { status: 400 })
//       }

//       const userRaw : { email: string, password: string } | null = await redis.get(`user:${userId}`)
//       if (!userRaw) {
//         return NextResponse.json({ error: 'Invalid email or password two' }, { status: 400 })
//       }
//        // Check if the userRaw is already an object or a stringified JSON
//        let user: { email: string, password: string }
//        if (typeof userRaw === 'string') {
//          // Parse if it's a string
//          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
//          user = JSON.parse(userRaw)
//        } else {
//          // If it's already an object, use it directly
//          user = userRaw
//        }

//       const isPasswordMatch = await bcrypt.compare(password, user.password)
//       if (!isPasswordMatch) {
//         return NextResponse.json({ error: 'Invalid email or password three' }, { status: 400 })
//       }

//       // Sign and return a JWT token (stored client-side for session auth)
//       // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
//       const token = jwt.sign({ email: user.email }, env.JWT_SECRET, { expiresIn: '30d' })
//       // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
//       return NextResponse.json({ token , userId }, { status: 200 })
//     }

//     // Fallback for unsupported actions
//     return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

//   } catch (error: unknown) {
//     // Narrow the error type to handle the known properties of an error
//     if (error instanceof Error) {
//       console.error('Unexpected error:', error.message)
//     } else {
//       console.error('Unexpected error:', error)
//     }
//     return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
//   }
// }
