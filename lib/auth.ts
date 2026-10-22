import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { database } from "./db";

let instance: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  if (!process.env.SITE_ORIGIN) throw new Error("SITE_ORIGIN is required.");
  return betterAuth({
    appName: "Nos liens, notre histoire",
    baseURL: process.env.SITE_ORIGIN,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.SITE_ORIGIN],
    database: prismaAdapter(database(), { provider: "postgresql" }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 16, maxPasswordLength: 128 },
    session: { expiresIn: 12 * 60 * 60, updateAge: 60 * 60, cookieCache: { enabled: false } },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "admin", input: false },
        active: { type: "boolean", defaultValue: true, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await database().user.findUnique({ where: { id: session.userId }, select: { active: true, role: true } });
            if (!user?.active || user.role !== "admin") return false;
            return { data: session };
          },
        },
      },
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60, customRules: { "/sign-in/email": { window: 900, max: 5 } } },
    advanced: {
      ipAddress: { ipAddressHeaders: process.env.VERCEL ? ["x-vercel-forwarded-for"] : ["x-real-ip"] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    },
  });
}

export function authentication() {
  instance ??= createAuth();
  return instance;
}
