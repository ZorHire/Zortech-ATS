import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AppNotification {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  timestamp: number;
}

interface NotificationState {
  queue: AppNotification[];
}

const initialState: NotificationState = {
  queue: [],
};

export const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    addNotification: (
      state,
      action: PayloadAction<Omit<AppNotification, "id" | "timestamp">>
    ) => {
      state.queue.push({
        ...action.payload,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter((n) => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.queue = [];
    },
  },
});

export const { addNotification, removeNotification, clearNotifications } =
  notificationSlice.actions;

export default notificationSlice.reducer;
