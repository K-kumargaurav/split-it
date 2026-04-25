import type { DefaultSession } from "next-auth";

export interface AppUser {
  id: string;
  handle: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

export interface AppSession {
  user: {
    id: string;
    handle: string;
    email: string | null;
    name: string | null;
    image: string | null;
  };
  expires: string;
}

export interface AppJWT {
  id: string;
  handle: string;
  sub?: string;
}

declare module "next-auth" {
  interface User {
    handle?: string;
  }

  interface Session {
    user: {
      id: string;
      handle: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    handle: string;
  }
}
