import { NextResponse } from "next/server";
import { env } from "@/env";
export function GET() {
  //   if (env.NODE_ENV === "production") {
  //     return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  //   }
  const response = {
    workspace: {
      root: process.cwd(),
      uuid: "8e4a7b02-1c2d-4f3e-8a9b-0c1d2e3f4a5b",
    },
  };
  return NextResponse.json(response, {
    headers: { "Content-Type": "application/json" },
  });
}
