import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import authReducer from "./slices/authSlice";
import subscriptionReducer from "./slices/subscriptionSlice";
import tenantReducer from "./slices/tenantSlice";
import permissionReducer from "./slices/permissionSlice";
import featureReducer from "./slices/featureSlice";
import uiReducer from "./slices/uiSlice";
import notificationReducer from "./slices/notificationSlice";
import { baseApi } from "./api/baseApi";
import { authMiddleware } from "./middleware/authMiddleware";

const rootReducer = combineReducers({
  auth: authReducer,
  subscription: subscriptionReducer,
  tenant: tenantReducer,
  permissions: permissionReducer,
  features: featureReducer,
  ui: uiReducer,
  notifications: notificationReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

// Only persist ui (sidebar state, theme). Auth is restored on each load by
// SessionRestorer via useMeQuery; token lives in localStorage["jwt"] for legacy api.ts.
const persistConfig = {
  key: "root",
  storage,
  whitelist: ["ui"],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer as unknown as typeof rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware, authMiddleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
