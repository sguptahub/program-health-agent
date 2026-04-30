import OpenAI from "openai";

const apiKey =
  process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const baseURL =
  process.env.OPENAI_BASE_URL ?? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!apiKey) {
    throw new Error(
      "OpenAI is not configured. Set OPENAI_API_KEY (or AI_INTEGRATIONS_OPENAI_API_KEY) in the environment.",
    );
  }
  if (!client) {
    client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }
  return client;
}

export const PROVIDER_USED = "openai";
export const MODEL_NAME = "gpt-4o";
