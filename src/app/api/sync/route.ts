import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Hello World',
  })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    message: 'Hello World',
  })
}

export async function PUT(request: NextRequest) {
  return NextResponse.json({
    message: 'Hello World',
  })
}
