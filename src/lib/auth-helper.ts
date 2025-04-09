import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const alg = "HS256";

export async function createJWT(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}
