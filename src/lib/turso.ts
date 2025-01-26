// lib/turso.ts
import { createClient } from '@libsql/client/web'

export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})
