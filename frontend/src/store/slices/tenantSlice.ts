import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface TenantState {
  tenantId: string | null;
  tenantName: string | null;
}

const initialState: TenantState = {
  tenantId: null,
  tenantName: null,
};

export const tenantSlice = createSlice({
  name: "tenant",
  initialState,
  reducers: {
    setTenant: (
      state,
      action: PayloadAction<{ tenantId: string; tenantName: string }>
    ) => {
      state.tenantId = action.payload.tenantId;
      state.tenantName = action.payload.tenantName;
    },
    clearTenant: (state) => {
      state.tenantId = null;
      state.tenantName = null;
    },
  },
});

export const { setTenant, clearTenant } = tenantSlice.actions;

export const selectTenantId = (state: { tenant: TenantState }) =>
  state.tenant.tenantId;

export default tenantSlice.reducer;
