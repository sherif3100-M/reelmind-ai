import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const NICHE_CONTEXT = {
  finance: 'personal finance, investing, saving money, wealth building, passive income',
  motivation: 'mindset, productivity, success habits, morning routines, self-improvement',
  tech: 'artificial intelligence, tech news, gadgets, software tools, startups',
  facts: 'amazing world facts, history mysteries, science discoveries, world records',
  fitness: 'workout tips, nutrition advice, weight loss, muscle building, health',
  books: 'book summaries, key lessons, author insights, reading recommendations',
  gaming: 'gaming tips, game reviews, esports highlights, hidden game features',
  cooking: 'quick recipes, cooking hacks, meal prep, nutrition facts',
  history: 'historical events, ancient civilizations, forgotten stories, mysteries',
  mystery: 'unsolved mysteries, conspiracy theories, paranormal events, cold cases',
};

export async function generateVideoScript({ niche, duration, customPrompt, style, voice }) {
  const words = duration <= 15 ? 40 : duration <= 30 ? 80 : duration <= 60 ? 150 : 220;
  const ctx = NICHE_CONTEXT[niche] || niche;

  const prompt = `You are an expert viral YouTube Shorts script writer for faceless AI channels.
Write a ${duration}-second script for: ${ctx}
${customPrompt ? `Specific topic: ${customPrompt}` : ''}
Style: ${style}. Voice tone: ${voice.replace('_', ' ')}.

RULES:
- Hook must grab attention in first 3 seconds (curiosity, shock, or bold claim)
- Keep sentences short and punchy
- No filler words
- ~${words} words total for narration

Return ONLY valid JSON (no markdown, no backticks):
{
  "hook": "First line that stops scrollers (max 12 words)",
  "body": "Middle content with value/facts (${Math.round(words * 0.7)} words)",
  "cta": "End call to action (max 8 words, e.g. follow for more)",
  "full_script": "Complete narration from hook to cta (~${words} words)",
  "seo_title": "YouTube title with numbers/power words (max 60 chars)",
  "seo_description": "YouTube description with keywords (max 150 chars)",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8"],
  "search_keywords": ["keyword1","keyword2","keyword3"],
  "viral_score": 82,
  "viral_reason": "One sentence explaining the viral potential"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Gemini returned invalid JSON: ' + text.slice(0, 200));
  }
}

export async function getTrendingTopics(niche) {
  const prompt = `List 5 trending topics RIGHT NOW for viral YouTube Shorts in the ${niche} niche.
Return ONLY JSON array (no markdown):
[{"title":"...","hook":"...","viral_potential":90,"reason":"..."}]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch { return []; }
}
