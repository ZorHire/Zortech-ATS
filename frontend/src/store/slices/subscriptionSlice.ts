import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface SubscriptionInfo {
  active: boolean;
  isPlatformOwner: boolean;
  reason: string | null;
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
    clearSubscription: (state) => {
      state.data = null;
    },
  },
});

export const { setSubscription, clearSubscription } = subscriptionSlice.actions;

// null = loading / not yet hydrated → gate fails open (user is not blocked)
export const selectSubscription = (state: { subscription: SubscriptionState }) =>
  state.subscription.data;

export default subscriptionSlice.reducer;
