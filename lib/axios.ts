"use client";
import axios from "axios";

const BACKEND_URL: string | undefined = process.env.NEXT_PUBLIC_API_URL;
if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

export const backendUrl = BACKEND_URL;

const api = axios.create({
  baseURL: BACKEND_URL,
});

api.interceptors.request.use(
  (config) => {
    const token =
      typeof window != "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
// 🔹 Response Interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle expired token, API errors, etc.
    if (error.response?.status === 401) {
      console.error("Unauthorized - maybe redirect to login?");
    }
    return Promise.reject(error);
  }
);

export default api;
