import crypto from "crypto";

const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"];

if (!ADMIN_PASSWORD) {
  console.warn("[AdminAuth] ADMIN_PASSWORD secret is not set — admin dashboard will be inaccessible");
}

// In-memory token store: token -> expiry timestamp (ms)
const adminTokens = new Map<string, number>();
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Periodically clean up expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of adminTokens.entries()) {
    if (expiry < now) adminTokens.delete(token);
  }
}, 60 * 60 * 1000);

export function verifyAdminPassword(password: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  try {
    const a = Buffer.from(password.padEnd(64), "utf8").slice(0, 64);
    const b = Buffer.from(ADMIN_PASSWORD.padEnd(64), "utf8").slice(0, 64);
    return crypto.timingSafeEqual(a, b) && password === ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

export function createAdminToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  adminTokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export function validateAdminToken(token: string): boolean {
  const expiry = adminTokens.get(token);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

export function adminMiddleware(req: any, res: any, next: any): void {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!token || !validateAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
