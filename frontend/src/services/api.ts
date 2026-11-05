import axios from "axios";

export const api = axios.create({ baseURL: "/api", timeout: 180_000, withCredentials: true });

api.interceptors.response.use((response) => response, (error) => {
  const status = error?.response?.status;
  const url = String(error?.config?.url || "");
  if (status === 401 && !url.endsWith("/auth/me") && !url.endsWith("/auth/login")) {
    window.dispatchEvent(new Event("rootpulse:auth-expired"));
  }
  return Promise.reject(error);
});

export interface FarmerUser {
  id: number;
  full_name: string;
  username: string;
  phone: string | null;
  created_at: string;
  recovery_configured?: boolean;
}
export interface AuthResponse { status: string; user?: FarmerUser; error?: string; }
export const getCurrentUser = async () =>
  (await api.get<{ user: FarmerUser }>("/auth/me")).data.user;
export const registerFarmer = async (data: {
  full_name: string;
  username: string;
  password: string;
  phone?: string;
  security_answer1: string;
  security_answer2: string;
}) => (await api.post<AuthResponse>("/auth/register", data)).data;
export const loginFarmer = async (username: string, password: string) =>
  (await api.post<AuthResponse>("/auth/login", { username, password })).data;
export const logoutFarmer = async () => (await api.post<AuthResponse>("/auth/logout")).data;

export interface RecoveryQuestionsResponse { status: "available" | "unavailable"; questions?: string[]; message?: string; }
export const getRecoveryQuestions = async (username: string) =>
  (await api.post<RecoveryQuestionsResponse>("/auth/recovery/questions", { username })).data;
export const verifyRecoveryAnswers = async (username: string, answer1: string, answer2: string) =>
  (await api.post<{ status: string; recovery_token: string }>("/auth/recovery/verify", { username, answer1, answer2 })).data;
export const resetFarmerPassword = async (username: string, recovery_token: string, new_password: string) =>
  (await api.post<{ status: string; message: string }>("/auth/recovery/reset", { username, recovery_token, new_password })).data;
export const setupRecoveryAnswers = async (answer1: string, answer2: string) =>
  (await api.post<{ status: string; message: string }>("/auth/recovery/setup", { answer1, answer2 })).data;

export interface HealthResponse { status: string; service: string; }
export type AnalysisStatus = "healthy" | "possible_issue" | "uncertain" | "unsupported_crop";
export interface AnalyzeResponse {
  analysis_id?: number;
  status: AnalysisStatus;
  crop_name: string;
  condition: string | null;
  candidate_condition: string | null;
  confidence: number | null;
  explanation: string;
  next_steps: string[];
  model?: string;
  limitations: string;
}
export interface RecentCropAnalysis extends AnalyzeResponse {
  id: number;
  created_at: string;
}
export type RecommendationStatus = "irrigate" | "wait" | "review_conditions";
export interface WeatherContext {
  source: string;
  location: string;
  temperature_c: number;
  humidity_pct: number;
  current_precipitation_mm: number;
  rainfall_next_24h_mm: number;
  precipitation_probability_max_pct: number | null;
  forecast_timestamp: string;
  timezone: string;
}
export interface InputFactor {
  label: string;
  value: string;
  role: string;
}
export interface IrrigationRecommendation {
  status: RecommendationStatus;
  crop_name: string | null;
  growth_stage: string | null;
  soil_type: string | null;
  soil_moisture: number | null;
  moisture_status: "low" | "adequate" | "high" | "unavailable";
  illustrative_thresholds: { low_below_pct: number; high_at_or_above_pct: number } | null;
  weather: WeatherContext | null;
  weather_status: "available" | "error" | "missing_location" | "not_requested";
  weather_message: string | null;
  rain_smart_alert: { title: string; message: string } | null;
  input_factors: InputFactor[];
  threshold_note: string;
  explanation: string;
  next_action: string;
}

export interface IrrigationRequest {
  crop_name: string | null;
  growth_stage: string | null;
  soil_type: string | null;
  soil_moisture: number | null;
  location: string | null;
  field_size: number | null;
  field_size_unit: "hectares" | "acres";
  notes: string | null;
}

export const getHealth = async () => (await api.get<HealthResponse>("/health")).data;
export const analyzeCrop = async (image: File, cropName: string) => {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("crop_name", cropName);
  return (await api.post<AnalyzeResponse>("/analyze", formData)).data;
};
export const getRecentCropAnalyses = async () =>
  (await api.get<{ analyses: RecentCropAnalysis[] }>("/analyze/recent")).data.analyses;
export const requestIrrigationRecommendation = async (data: IrrigationRequest) =>
  (await api.post<IrrigationRecommendation>("/irrigation/recommend", data)).data;

export interface ProgressCrop {
  id: number;
  crop_name: string;
  field_name: string | null;
  created_at: string;
}
export interface ProgressPhoto {
  id: number;
  crop_id: number;
  captured_at: string;
  note: string | null;
  image_url: string;
  created_at: string;
  analysis: AnalyzeResponse | null;
}
export const getProgressCrops = async () =>
  (await api.get<{ crops: ProgressCrop[] }>("/progress/crops")).data.crops;
export interface ProgressSummary {
  crop_count: number;
  field_count: number;
  progress_photo_count: number;
}
export const getProgressSummary = async () =>
  (await api.get<ProgressSummary>("/progress/summary")).data;
export const getDashboardWeather = async (location: string) =>
  (await api.get<{ weather: WeatherContext }>("/irrigation/weather", { params: { location } })).data.weather;
export const createProgressCrop = async (cropName: string, fieldName: string) =>
  (await api.post<{ crop: ProgressCrop }>("/progress/crops", {
    crop_name: cropName,
    field_name: fieldName || null,
  })).data.crop;
export const getCropProgress = async (cropId: number) =>
  (await api.get<{ photos: ProgressPhoto[] }>("/progress/" + cropId)).data.photos;
export const uploadProgressPhoto = async (
  cropId: number,
  image: File,
  capturedAt: string,
  note: string,
) => {
  const formData = new FormData();
  formData.append("crop_id", String(cropId));
  formData.append("captured_at", capturedAt);
  formData.append("note", note);
  formData.append("image", image);
  return (await api.post<{ photo: ProgressPhoto; message: string }>("/progress/upload", formData)).data;
};

export type ChatLanguage = "en" | "ta" | "hi";
export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}
export interface ChatResponse {
  status: "ok" | "not_configured" | "error";
  response?: string;
  message?: string;
  language: ChatLanguage;
  context_used: {
    crop_name: string;
    field_name: string | null;
    observation_count: number;
  } | null;
}
export const sendCropChatMessage = async (
  message: string,
  language: ChatLanguage,
  cropId: number | null,
  history: ChatMessageInput[],
) => (await api.post<ChatResponse>("/chat", {
  message,
  language,
  crop_id: cropId,
  history,
})).data;
