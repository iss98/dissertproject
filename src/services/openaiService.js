import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function fetchHelpResponse({ input }) {
  return await openai.responses.create({
    model : "gpt-5",
    input : input,
    text: {
      format: { type: "text" },
    },
  });
}