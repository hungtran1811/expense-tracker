// Firebase config (public; safe to expose). Fill with your project values.
export const firebaseConfig = {
  apiKey: "AIzaSyCAExxeNtJVH-KJjARpmtpEQjUgOJHcGis",
  authDomain: "quanlychitieu-a3ad2.firebaseapp.com",
  projectId: "quanlychitieu-a3ad2",
  storageBucket: "quanlychitieu-a3ad2.firebasestorage.app",
  messagingSenderId: "100750353991",
  appId: "1:100750353991:web:e39100b12ad59e99fa7362",
};
// **Single-user lock**: set exactly ONE allowed UID (recommended) or email (fallback).
export const AUTH_LOCK = {
  allowedUid: "a7wUnSYvVKdTxlQV7jjVzK8ZxNN2", // <- after first login, copy your UID here
  allowedEmail: "hungtran00.nt@gmail.com", // optional: extra guard
};
