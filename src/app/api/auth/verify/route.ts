import { verifyJWT } from "@/lib/auth-helper";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { token } = await req.json();
  const payload = await verifyJWT(token);
  return payload
    ? NextResponse.json({ valid: true, user: payload })
    : NextResponse.json({ valid: false }, { status: 401 });
}
