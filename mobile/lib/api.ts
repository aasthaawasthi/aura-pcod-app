import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// --- Base URL setup -------------------------------------------------------
// On a physical phone (Expo Go), "localhost" means the phone itself, not
// your laptop. Expo exposes the dev machine's LAN IP via the packager
// hostUri, so we derive it automatically when running in dev. In a
// production build, set EXPO_PUBLIC_API_URL instead.

function getDevHost(): string | null {
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  return host || null;
}

function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL as string;
  }
  const devHost = getDevHost();
  if (devHost) {
    return `http://${devHost}:4000/api/v1`;
  }
  return "http://localhost:4000/api/v1";
}

export const API_BASE_URL = resolveBaseUrl();

const TOKEN_KEY = "aura_auth_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Does the actual fetch + parse + error handling, and resolves with the
// full response body (not just its `data` field) - most endpoints only
// need `.data`, which `request()` below returns, but a few (like the
// habits list, which also reports whether the date is editable) need the
// sibling fields too.
async function requestFull(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<any> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Without this, a request that hangs (weak Wi-Fi, server not actually
  // reachable, a large upload stalling) sits "loading" forever with no
  // feedback - this gives it a hard cutoff and a clear, specific error
  // instead of a silent, indefinite spinner.
  const REQUEST_TIMEOUT_MS = 20000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        `The request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Check your Wi-Fi connection and that the backend is reachable, then try again.`,
        0
      );
    }
    throw new ApiError(
      `Could not reach the server at ${API_BASE_URL}. Make sure the backend is running and your phone is on the same Wi-Fi network.`,
      0
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let json: any = {};
  let parsedOk = true;
  try {
    json = await res.json();
  } catch {
    parsedOk = false;
  }

  if (!res.ok || json.success === false) {
    // The backend normally sends a specific { message } explaining what went
    // wrong (e.g. "Invalid email or password"). If we got here without one,
    // it means something failed before it reached our route handlers -
    // most commonly the backend isn't running, crashed, or a proxy/network
    // device returned an error page instead of JSON. Say that plainly
    // instead of a generic "Something went wrong".
    const fallback = !parsedOk
      ? `The server responded with something unexpected (HTTP ${res.status}), not JSON. Double-check your backend server is running and reachable.`
      : `Request failed (HTTP ${res.status}). The backend didn't say why - check that it's running and try again.`;
    throw new ApiError(json.message || fallback, res.status);
  }

  return json;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const json = await requestFull(path, options);
  return json.data as T;
}

// ---------- Auth ----------
export const authApi = {
  requestOtp: (phone: string) =>
    request<{ phone: string; expiresInSeconds: number; devOtp?: string }>("/auth/otp/request", {
      method: "POST",
      body: { phone },
      auth: false,
    }),
  verifyOtp: (phone: string, otp: string) =>
    request<{ token: string; userId: number }>("/auth/otp/verify", {
      method: "POST",
      body: { phone, otp },
      auth: false,
    }),
  me: () => request<{ id: number; phone: string | null; email: string | null; name: string | null }>("/auth/me"),
};

// ---------- Profile ----------
export type Profile = {
  user_id: number;
  // Identity - lives on the users table, merged in by the backend.
  name: string | null;
  email: string;
  phone: string | null;
  profile_picture: string | null;
  // Health & preferences
  goals: string[];
  food_preference: string;
  regions: string[];
  has_pcod: number;
  profile_type: string;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  onboarding_complete: number;
};

export const profileApi = {
  get: () => request<Profile>("/profile"),
  save: (fields: Record<string, unknown>) =>
    request<Profile>("/profile", { method: "POST", body: fields }),
};

// ---------- Daily log ----------
export type DailyLog = {
  id: number;
  log_date: string;
  mood: string | null;
  energy: number | null;
  symptoms: string[];
  note: string | null;
};

export const dailyLogApi = {
  today: () => request<DailyLog | null>("/daily-log/today"),
  recent: () => request<DailyLog[]>("/daily-log"),
  save: (payload: {
    mood?: string | null;
    energy?: number | null;
    symptoms?: string[];
    note?: string;
    logDate?: string;
  }) => request<DailyLog>("/daily-log", { method: "POST", body: payload }),
};

// ---------- Habits ----------
export type Habit = {
  id: number;
  name: string;
  icon: string;
  done: boolean;
  streak: number;
};

export type HabitCalendar = {
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  completedDays: number[]; // day-of-month numbers where every habit was done
  streak: number; // consecutive fully-completed days
  todayCompleted: boolean;
};

export type HabitsForDate = { habits: Habit[]; date: string; editable: boolean };

export const habitsApi = {
  list: () => request<Habit[]>("/habits"),
  // Same endpoint as list(), but also reports which date it's showing and
  // whether that date can still be edited (only ever true for today) - lets
  // the habits screen show a past day read-only instead of just today's.
  forDate: async (date: string): Promise<HabitsForDate> => {
    const json = await requestFull(`/habits?date=${date}`);
    return { habits: json.data as Habit[], date: json.date, editable: json.editable };
  },
  log: (habitId: number, completed: boolean) =>
    request<{ habitId: number; completed: boolean; streak: number }>("/habits/log", {
      method: "POST",
      body: { habitId, completed },
    }),
  saveBatch: (logDate: string, logs: { habitId: number; completed: boolean }[]) =>
    request<{ logDate: string; saved: number }>("/habits/log-batch", {
      method: "POST",
      body: { logDate, logs },
    }),
  calendar: (year: number, month: number) =>
    request<HabitCalendar>(`/habits/calendar?year=${year}&month=${month}`),
};

// ---------- Diet ----------
export type Diet = {
  breakfast: string;
  lunch: string;
  snack: string;
  dinner: string;
};

export type DietDay = {
  date: string;
  region?: string;
  breakfast: string | null;
  lunch: string | null;
  snack: string | null;
  dinner: string | null;
};
export type DietMonth = {
  year: number;
  month: number;
  daysInMonth: number;
  days: DietDay[];
  joinedDate?: string | null;
};

export const dietApi = {
  today: () => request<Diet>("/diet/today"),
  forDate: (date: string) => request<Diet>(`/diet?date=${date}`),
  week: (start: string) => request<DietDay[]>(`/diet/week?start=${start}`),
  month: (year: number, month: number) => request<DietMonth>(`/diet/month?year=${year}&month=${month}`),
  swap: (date: string, meal: "breakfast" | "lunch" | "snack" | "dinner") =>
    request<Diet>("/diet/swap", { method: "POST", body: { date, meal } }),
};

// ---------- Exercise ----------
export type Exercise = {
  id: string;
  name: string;
  goals: string[];
  durationLabel: string;
  level: string;
  description: string;
  youtubeId: string;
  thumbnailUrl: string;
  watchUrl: string;
};

export const exerciseApi = {
  today: () => request<Exercise[]>("/exercise/today"),
};

// ---------- Cycle ----------
export type CycleInfo = {
  hasData: boolean;
  message?: string;
  cycleDay?: number;
  lastPeriodStart?: string;
  avgCycleLength?: number | null;
  cycleLengthVariability?: number;
  predictedNextPeriod?: string | null;
  confidence?: "low" | "medium" | "high";
  irregular?: boolean | null;
  phase?: string;
  flag?: { level: string; message: string } | null;
  note?: string;
};

export type PeriodFlow = "light" | "medium" | "heavy";

export type PeriodDay = {
  log_date: string;
  flow: PeriodFlow;
  color: number; // 0 (dark brown) .. 5 (bright red)
};

export const cycleApi = {
  get: () => request<CycleInfo>("/cycle"),
  start: (periodStart: string, flow?: string) =>
    request("/cycle/start", { method: "POST", body: { periodStart, flow } }),
  logDays: (days: { date: string; flow: PeriodFlow; color: number }[]) =>
    request("/cycle/log-days", { method: "POST", body: { days } }),
  periodDays: (year: number, month: number) =>
    request<PeriodDay[]>(`/cycle/period-days?year=${year}&month=${month}`),
};

// ---------- Account deletion ----------
// Export/deletion aren't plain JSON round trips (export streams a binary
// zip; deletion has its own OTP-verification shape), so they get their
// own small wrapper here rather than going through request()/requestFull().
export const accountApi = {
  // Sends a fresh OTP to the logged-in user's own phone, as the
  // "prove it's really you right now" step before deletion - mirrors
  // login's OTP flow but scoped to whoever's already signed in.
  requestDeleteOtp: () =>
    request<{ phone: string; expiresInSeconds: number; devOtp?: string }>(
      "/account/delete/request-otp",
      { method: "POST" }
    ),
  // Verifies the OTP and, on success, permanently deletes the account and
  // everything tied to it. `alreadyDeleted: true` means the account was
  // already gone when this call landed (e.g. a retry after a dropped
  // response to an earlier successful call) - that's a success case, not
  // an error, since the end state ("account's gone") is what was wanted.
  confirmDelete: (otp: string, reasonCode?: string, note?: string) =>
    request<{ alreadyDeleted: boolean }>("/account/delete/confirm", {
      method: "POST",
      body: { otp, reasonCode, note },
    }),
};
