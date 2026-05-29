import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";

const ALLOWED_TRPC_PREFIX = "adminDashboard.";

function isAllowedTrpcPath(trpcPath: string) {
  if (!/^[A-Za-z0-9._,-]+$/.test(trpcPath)) return false;
  const procedures = trpcPath.split(",");
  return procedures.every((name) => name.startsWith(ALLOWED_TRPC_PREFIX));
}

function getWebBackendBaseUrl() {
  const explicit =
    process.env.WEB_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_WEB_API_URL?.trim();

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
    "Missing WEB_API_URL or NEXT_PUBLIC_WEB_API_URL for admin tRPC proxy. Do not use NEXT_PUBLIC_APP_URL here."
  );
}

function buildTargetUrl(req: NextRequest, trpcPath: string) {
  const backend = getWebBackendBaseUrl();
  const incoming = new URL(req.url);
  const target = new URL(`${backend}/api/trpc/${trpcPath}`);
  target.search = incoming.search;

  // Hard stop against accidental self-proxy loops (admin -> admin).
  if (target.host === incoming.host) {
    throw new Error(
      `Admin tRPC proxy loop detected: target host "${target.host}" equals incoming host. Set WEB_API_URL to your web app domain (e.g. https://example.com).`
    );
  }

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
  const startedAt = Date.now();

  // Get Clerk session token server-side from cookies — browser never needs to
  // handle the token directly, so TRPCProvider can stay free of useAuth().
  const { getToken } = await auth();
  const sessionToken = await getToken();

  const upstreamHeaders = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) upstreamHeaders.set("content-type", contentType);
  if (sessionToken) upstreamHeaders.set("authorization", `Bearer ${sessionToken}`);
  upstreamHeaders.set("x-request-id", requestId);
  upstreamHeaders.set("x-admin-proxy", "1");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const upstream = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: upstreamHeaders,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const resHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) resHeaders.set("content-type", upstreamContentType);
    resHeaders.set("cache-control", "no-store");
    resHeaders.set("x-request-id", requestId);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error("[admin-trpc-proxy] upstream request failed", {
      requestId,
      trpcPath,
      target: targetUrl.origin,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });

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
