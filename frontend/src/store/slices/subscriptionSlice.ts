import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface SubscriptionInfo {
  active: boolean;
  isPlatformOwner: boolean;
  /** "active" | "trial" | "expired" | "cancelled" | "none" | "platform_owner" */
  reason: string | null;
  planType?: string | null;
  /** ISO date the paid period ends. */
  endDate?: string | null;
  /** Days until endDate, rounded up. Null when not paid up or no end date. */
  daysLeft?: number | null;
}

/** Shape the API sends on login, OAuth exchange and /auth/me. */
export interface ApiSubscription {
  active: boolean;
  isPlatformOwner?: boolean;
  reason?: string | null;
  plan_type?: string | null;
  end_date?: string | null;
  days_left?: number | null;
}

export function toSubscriptionInfo(s: ApiSubscription | null | undefined): SubscriptionInfo | null {
  if (!s) return null;
  return {
    active: s.active,
    isPlatformOwner: s.isPlatformOwner ?? false,
    reason: s.reason ?? null,
    planType: s.plan_type ?? null,
    endDate: s.end_date ?? null,
    daysLeft: s.days_left ?? null,
  };
}

/** The plan was paid for once and has run out (as opposed to never bought). */
export function isLapsed(s: SubscriptionInfo | null): boolean {
  return !!s && !s.active && !s.isPlatformOwner && (s.reason === "expired" || s.reason === "cancelled");
}

interface SubscriptionState {
  data: SubscriptionInfo | null;
}

const initialState: SubscriptionState = {
  data: null,
};

export const subscriptionSlice = createSlice({
  name: "subscription",
  initialState,
  reducers: {
    setSubscription: (state, action: PayloadAction<SubscriptionInfo | null>) => {
      state.data = action.payload;
    },
    /** The API refused a request because the plan has ended (HTTP 402). */
    markSubscriptionLapsed: (state) => {
      if (state.data?.isPlatformOwner) return;
      state.data = {
        ...(state.data ?? { isPlatformOwner: false }),
        active: false,
        reason: state.data?.reason === "cancelled" ? "cancelled" : "expired",
        daysLeft: null,
      };
    },
    clearSubscription: (state) => {
      state.data = null;
    },
  },
});

export const { setSubscription, markSubscriptionLapsed, clearSubscription } = subscriptionSlice.actions;

// null = loading / not yet hydrated → gate fails open (user is not blocked)
export const selectSubscription = (state: { subscription: SubscriptionState }) =>
  state.subscription.data;

export default subscriptionSlice.reducer;
