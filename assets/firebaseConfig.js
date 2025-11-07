// Firebase config (public; safe to expose). Fill with your project values.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};
// **Single-user lock**: set exactly ONE allowed UID (recommended) or email (fallback).
export const AUTH_LOCK = {
  allowedUid: "a7wUnSYvVKdTxlQV7jjVzK8ZxNN2", // <- after first login, copy your UID here
  allowedEmail: "hungtran00.nt@gmail.com", // optional: extra guard
};
