import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface FeatureState {
  aiResumeParsing: boolean;
  vendorPortal: boolean;
  emailCampaigns: boolean;
}

const initialState: FeatureState = {
  aiResumeParsing: true,
  vendorPortal: true,
  emailCampaigns: true,
};

export const featureSlice = createSlice({
  name: "features",
  initialState,
  reducers: {
    setFeatures: (state, action: PayloadAction<Partial<FeatureState>>) => {
      Object.assign(state, action.payload);
    },
  },
});

export const { setFeatures } = featureSlice.actions;

export default featureSlice.reducer;
