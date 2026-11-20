import { baseApi } from "./baseApi";

export interface HelpArticleSummary {
  slug: string;
  title: string;
  category: string;
  summary: string;
}

export interface HelpArticle extends HelpArticleSummary {
  body: string;
}

export interface HelpTurn {
  role: "user" | "assistant";
  content: string;
}

export interface HelpAnswer {
  id: string;
  answer: string;
  answered: boolean;
  ai: boolean;
  articles: { slug: string; title: string }[];
  links: { label: string; path: string }[];
  support_email: string | null;
}

export const helpApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getHelpArticles: b.query<{ articles: HelpArticleSummary[]; support_email: string | null }, void>({
      query: () => "/help/articles",
      keepUnusedDataFor: 3600,
    }),
    getHelpArticle: b.query<HelpArticle, string>({
      query: (slug) => `/help/articles/${encodeURIComponent(slug)}`,
      keepUnusedDataFor: 3600,
    }),
    askHelp: b.mutation<HelpAnswer, { question: string; history: HelpTurn[]; page: string }>({
      query: (body) => ({ url: "/help/ask", method: "POST", body }),
    }),
    helpFeedback: b.mutation<{ ok: true }, { id: string; helpful: boolean }>({
      query: ({ id, helpful }) => ({ url: `/help/questions/${id}/feedback`, method: "POST", body: { helpful } }),
    }),
  }),
});

export const { useGetHelpArticlesQuery, useGetHelpArticleQuery, useAskHelpMutation, useHelpFeedbackMutation } = helpApi;
