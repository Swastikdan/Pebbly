import { turso } from '@/lib/turso'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// SQL Schema for reference - run this in your database
/*
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
*/

interface UserRow {
  email: string
  password: string
}

const isValidEmail = (email: string) => {
  return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
}

export async function POST(req: Request) {
  const { action, email, password } = await req.json()

  try {
    if (action === 'register') {
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 },
        )
      }

      const hashedPassword = await bcrypt.hash(password, 10)

      await turso.execute({
        sql: `INSERT INTO users (email, password) VALUES (?, ?)`,
        args: [email.toLowerCase(), hashedPassword],
      })

      const token = jwt.sign(
        { email: email.toLowerCase() },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' },
      )

      const response = NextResponse.json({ email })
      response.cookies.set('token', token, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
      })
      return response
    }

    if (action === 'login') {
      console.log('Login attempt for email:', email)

      const result = await turso.execute({
        sql: 'SELECT * FROM users WHERE email = ?',
        args: [email.toLowerCase()],
      })

      const user = result.rows[0] as unknown as UserRow | undefined

      if (!user?.password || !password) {
        console.log('Invalid credentials - user not found or missing password')
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 },
        )
      }

      const isValidPassword = await bcrypt.compare(password, user.password)
      console.log('Password valid:', isValidPassword)

      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 },
        )
      }

      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET!, {
        expiresIn: '30d',
      })

      const response = NextResponse.json({ email: user.email })
      response.cookies.set('token', token, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
      })
      return response
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
