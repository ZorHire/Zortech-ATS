import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type SessionStatus = "idle" | "active" | "expired" | "loggedOut";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string;
  is_active: boolean;
  must_change_password?: boolean;
  vendor_id?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  sessionStatus: SessionStatus;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  sessionStatus: "idle",
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: AuthUser; accessToken: string | null }>
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
    },
    clearCredentials: (state) => {
      state.user = null;
      state.accessToken = null;
      state.sessionStatus = "loggedOut";
    },
    setSessionStatus: (state, action: PayloadAction<SessionStatus>) => {
      state.sessionStatus = action.payload;
    },
  },
});

export const { setCredentials, clearCredentials, setSessionStatus } = authSlice.actions;

export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectAccessToken = (state: { auth: AuthState }) => state.auth.accessToken;
export const selectSessionStatus = (state: { auth: AuthState }) => state.auth.sessionStatus;
export const selectUserRole = (state: { auth: AuthState }) => state.auth.user?.role ?? null;

export default authSlice.reducer;
