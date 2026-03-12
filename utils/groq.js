const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const SYSTEM_PROMPT = `You are Scholar AI, a friendly assistant for ScholarStream — a scholarship platform.
Help students with: finding scholarships, writing essays, eligibility requirements, application process, deadlines.
Be concise, warm, and encouraging. Use bullet points when listing things.`;

export async function getGroqChatCompletion(message) {
  const response = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  return response.choices[0]?.message?.content;
}
