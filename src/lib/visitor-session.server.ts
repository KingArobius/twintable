import { useSession, getRequest } from "@tanstack/react-start/server";

export async function visitorSession() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("Search session isn't configured.");
  const req = getRequest();
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const https = forwardedProto ? forwardedProto.includes("https") : new URL(req.url).protocol === "https:";
  // The preview runs inside an embedded frame on another site, so a "lax" cookie is never sent
  // there. On HTTPS use a partitioned SameSite=None cookie so it works embedded and standalone.
  return useSession<{ visitor: string }>({
    password, name: "twin-table-visitor", maxAge: 60 * 60 * 24,
    cookie: https
      ? { httpOnly: true, sameSite: "none", secure: true, partitioned: true, path: "/" }
      : { httpOnly: true, sameSite: "lax", secure: false, path: "/" },
  });
}

export async function requireVisitorSession() {
  const session = await visitorSession();
  if (!session.data.visitor) throw new Error("Please refresh the page before searching.");
}