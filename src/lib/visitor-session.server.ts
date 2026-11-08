import { useSession, getRequest } from "@tanstack/react-start/server";

export async function visitorSession() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("Search session isn't configured.");
  return useSession<{ visitor: string }>({
    password, name: "twin-table-visitor", maxAge: 60 * 60 * 24,
    cookie: { httpOnly: true, sameSite: "lax", secure: new URL(getRequest().url).protocol === "https:", path: "/" },
  });
}

export async function requireVisitorSession() {
  const session = await visitorSession();
  if (!session.data.visitor) throw new Error("Please refresh the page before searching.");
}