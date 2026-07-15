import { baseApi } from "./baseApi";
import type {
  Plan,
  Subscription,
  RazorpayOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  PaymentTransaction,
  PlanType,
  BillingCycle,
} from "../../services/billing.service";

export const billingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPlans: builder.query<Plan[], void>({
      query: () => "/billing/plans",
      providesTags: ["Billing"],
    }),

    getCurrentSubscription: builder.query<Subscription | null, void>({
      query: () => "/billing/current",
      providesTags: ["Billing"],
    }),

    subscribe: builder.mutation<
      RazorpayOrderResponse,
      { plan_type: PlanType; billing_cycle: BillingCycle }
    >({
      query: (body) => ({ url: "/billing/subscribe", method: "POST", body }),
    }),

    verifyPayment: builder.mutation<VerifyPaymentResponse, VerifyPaymentRequest>({
      query: (body) => ({ url: "/billing/verify-payment", method: "POST", body }),
      invalidatesTags: ["Billing"],
    }),

    cancelSubscription: builder.mutation<{ message: string }, void>({
      query: () => ({ url: "/billing/cancel", method: "POST", body: {} }),
      invalidatesTags: ["Billing"],
    }),

    getTransactions: builder.query<PaymentTransaction[], void>({
      query: () => "/billing/transactions",
      providesTags: ["Billing"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPlansQuery,
  useGetCurrentSubscriptionQuery,
  useSubscribeMutation,
  useVerifyPaymentMutation,
  useCancelSubscriptionMutation,
  useGetTransactionsQuery,
} = billingApi;
