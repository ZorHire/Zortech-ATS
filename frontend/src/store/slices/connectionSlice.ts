import { createSlice } from "@reduxjs/toolkit";

/**
 * Tracks whether the ZorHire API is reachable. Set by the RTK Query base
 * query on network failures, timeouts and gateway errors, cleared on the next
 * successful response. Not persisted.
 */
interface ConnectionState {
  serverUnreachable: boolean;
}

const initialState: ConnectionState = { serverUnreachable: false };

export const connectionSlice = createSlice({
  name: "connection",
  initialState,
  reducers: {
    markServerUnreachable: (state) => {
      state.serverUnreachable = true;
    },
    markServerReachable: (state) => {
      state.serverUnreachable = false;
    },
  },
});

export const { markServerUnreachable, markServerReachable } = connectionSlice.actions;

export const selectServerUnreachable = (state: { connection: ConnectionState }) =>
  state.connection.serverUnreachable;

export default connectionSlice.reducer;
