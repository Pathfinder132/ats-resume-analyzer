import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  timeout: 120000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || { message: "Network error" }),
);

// Resume
export const uploadResume = (file, sessionId, onProgress) => {
  const form = new FormData();
  form.append("resume", file);
  form.append("sessionId", sessionId);
  return api.post("/resume/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
  });
};

export const analyzeResume = (resumeId) => api.post("/resume/analyze", { resumeId });

export const matchJD = (resumeId, jobDescription, jobTitle) =>
  api.post("/resume/match-jd", { resumeId, jobDescription, jobTitle });

export const getResumeStatus = (resumeId) => api.get(`/resume/status/${resumeId}`);

// Payment
export const createPaymentOrder = (resumeId) => api.post("/payment/create-order", { resumeId });

export const verifyPayment = (payload) => api.post("/payment/verify", payload);

// Auth
export const register = (data) => api.post("/auth/register", data);
export const login = (data) => api.post("/auth/login", data);

export default api;