import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const ALLOWED_TRPC_PREFIX = "adminDashboard.";

function isAllowedTrpcPath(trpcPath: string) {
  if (!/^[A-Za-z0-9._,-]+$/.test(trpcPath)) return false;
  const procedures = trpcPath.split(",");
  return procedures.every((name) => name.startsWith(ALLOWED_TRPC_PREFIX));
}

function getWebBackendBaseUrl() {
  const explicit =
    process.env.WEB_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_WEB_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicit) {
    const normalized = explicit.replace(/\/+$/, "");
    const parsed = new URL(normalized);
    if (
      process.env.NODE_ENV === "production" &&
      parsed.protocol !== "https:"
    ) {
      throw new Error("WEB_API_URL must use https in production.");
    }
    return normalized;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  throw new Error(
    "Missing WEB_API_URL or NEXT_PUBLIC_WEB_API_URL for admin tRPC proxy."
  );
}

function buildTargetUrl(req: NextRequest, trpcPath: string) {
  const backend = getWebBackendBaseUrl();
  const incoming = new URL(req.url);
  const target = new URL(`${backend}/api/trpc/${trpcPath}`);
  target.search = incoming.search;
  return target;
}

async function proxy(req: NextRequest, trpcPath: string) {
  if (!isAllowedTrpcPath(trpcPath)) {
    return NextResponse.json({ error: "Forbidden tRPC procedure" }, { status: 403 });
  }

  const targetUrl = buildTargetUrl(req, trpcPath);
  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const requestId = req.headers.get("x-request-id") ?? randomUUID();

  const upstreamHeaders = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) upstreamHeaders.set("content-type", contentType);
  const authorization = req.headers.get("authorization");
  if (authorization) upstreamHeaders.set("authorization", authorization);
  upstreamHeaders.set("x-request-id", requestId);
  upstreamHeaders.set("x-admin-proxy", "1");

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: upstreamHeaders,
      body,
      redirect: "manual",
    });

    const resHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) resHeaders.set("content-type", upstreamContentType);
    resHeaders.set("cache-control", "no-store");
    resHeaders.set("x-request-id", requestId);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Upstream admin API unavailable", requestId },
      { status: 502, headers: { "cache-control": "no-store", "x-request-id": requestId } }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trpc: string }> }
) {
  const { trpc } = await params;
  return proxy(req, trpc);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ trpc: string }> }
) {
  const { trpc } = await params;
  return proxy(req, trpc);
}

export async function OPTIONS(
  req: NextRequest,
  { params }: { params: Promise<{ trpc: string }> }
) {
  const { trpc } = await params;
  return proxy(req, trpc);
}
