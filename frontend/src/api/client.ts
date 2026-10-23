import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<() => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/auth/")) {
      if (isRefreshing) {
        await new Promise<void>((resolve) => pendingQueue.push(resolve));
        return api(originalRequest);
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem("refreshToken");

      try {
        if (!refreshToken) throw new Error("No refresh token");
        const { data } = await axios.post("/api/auth/refresh", { refreshToken });
        localStorage.setItem("accessToken", data.data.accessToken);
        localStorage.setItem("refreshToken", data.data.refreshToken);
        pendingQueue.forEach((resolve) => resolve());
        pendingQueue = [];
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  return promise.then((res) => res.data.data);
}

export function errorMessage(err: unknown): string {
  const anyErr = err as any;
  return anyErr?.response?.data?.message || anyErr?.message || "Something went wrong.";
}

export type Row = Record<string, any>;

/** Downloads a protected file/CSV by fetching it with the auth header and saving the blob. */
export async function downloadFile(url: string, fallbackName: string) {
  const res = await api.get(url.replace(/^\/api/, ""), { responseType: "blob" });
  const disposition: string = res.headers["content-disposition"] ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}

/** Uploads a file to the generic file store and returns {id, name, url}. */
export async function uploadFile(file: File): Promise<{ id: string; name: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/files", form);
  return res.data.data;
}
