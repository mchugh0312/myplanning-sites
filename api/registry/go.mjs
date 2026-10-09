// Vercel Function: GET /api/registry/go
// Next.js App Router instead? Move this to app/api/registry/go/route.js
// and fix the import path; the handler is the same.
import { waitUntil } from "@vercel/functions";
import { handleGo } from "../../lib/registry/handler.mjs";
import { createSoftr } from "../../lib/registry/softr.mjs";

const softr = createSoftr({
  databaseId: process.env.SOFTR_DATABASE_ID,
  apiKey: process.env.SOFTR_API_KEY,
});

export async function GET(request) {
  return handleGo(request, { softr, waitUntil, env: process.env });
}

export const HEAD = GET;
