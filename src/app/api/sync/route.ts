// code for the /api/sync route

import { turso } from '@/lib/turso'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  email: string
}

interface WatchlistItem {
  externalId: string
  [key: string]: any
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
    console.log('Syncing watchlist for:', decoded)
    const { watchlist } = (await req.json()) as { watchlist: WatchlistItem[] }

    await turso.batch([
      {
        sql: 'DELETE FROM watchlist WHERE user_email = ?',
        args: [decoded.email],
      },
      ...watchlist.map((item) => ({
        sql: 'INSERT INTO watchlist (user_email, externalId, data) VALUES (?, ?, ?)',
        args: [decoded.email, item.externalId, JSON.stringify(item)],
      })),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
    const result = await turso.execute({
      sql: 'SELECT data FROM watchlist WHERE user_email = ? ORDER BY created_at ASC',
      args: [decoded.email],
    })

    const watchlist = result.rows
      .map((row) =>
        typeof row.data === 'string' ? JSON.parse(row.data) : null,
      )
      .filter((item) => item !== null)
    return NextResponse.json(watchlist)
  } catch (error) {
    console.error('Fetch error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
