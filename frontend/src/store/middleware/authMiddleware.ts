import type { Middleware } from "redux";
import { clearCredentials } from "../slices/authSlice";
import { clearSubscription } from "../slices/subscriptionSlice";
import { clearTenant } from "../slices/tenantSlice";
import { clearPermissions } from "../slices/permissionSlice";
import { baseApi } from "../api/baseApi";

// Single enforcement point for the full logout chain.
// Fires whenever clearCredentials is dispatched (explicit logout, 401, session expiry).
export const authMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  const result = next(action);
  if (clearCredentials.match(action)) {
    localStorage.removeItem("jwt");
    storeAPI.dispatch(clearSubscription());
    storeAPI.dispatch(clearTenant());
    storeAPI.dispatch(clearPermissions());
    storeAPI.dispatch(baseApi.util.resetApiState());
  }
  return result;
};
