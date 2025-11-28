import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db';
import * as schema from '../db/schema';

export const authConfig = {
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      users: schema.users,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60, // 1 hour
    updateAge: 60 * 5, // 5 minutes
  },
  account: {
    accountLinking: {
      enabled: false,
    },
  },
  socialProviders: {},
};

export const auth = betterAuth(authConfig);

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
