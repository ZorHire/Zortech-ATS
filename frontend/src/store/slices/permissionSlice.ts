import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface PermissionState {
  role: string | null;
  permissions: string[];
}

const initialState: PermissionState = {
  role: null,
  permissions: [],
};

export const permissionSlice = createSlice({
  name: "permissions",
  initialState,
  reducers: {
    setPermissions: (
      state,
      action: PayloadAction<{ role: string; permissions: string[] }>
    ) => {
      state.role = action.payload.role;
      state.permissions = action.payload.permissions;
    },
    clearPermissions: (state) => {
      state.role = null;
      state.permissions = [];
    },
  },
});

export const { setPermissions, clearPermissions } = permissionSlice.actions;

export default permissionSlice.reducer;
