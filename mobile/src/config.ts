import Constants from "expo-constants";

/** API origin (no trailing slash). Override with EXPO_PUBLIC_API_URL. */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  "https://legal.webprintmedia.swiss"
).replace(/\/$/, "");

export const TRPC_URL = `${API_URL}/api/trpc`;
export const UPLOAD_URL = `${API_URL}/api/upload`;
export const LOGIN_URL = `${API_URL}/api/auth/login`;
