import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Message { role: 'user' | 'assistant'; content: string; }

function buildSystem(villainName?: string, villainContext?: string): string {
  const vs = villainName && villainContext
    ? `\n\nVILLAIN TYPE: ${villainName}\n${villainContext}\n`
    : '';
  return `You are an expert poker coach specialising in exploitative play against specific player types. The student is practising making in-game decisions as the hero, then getting feedback on whether their decisions were exploitatively correct against a specific villain type.${vs}
IMPORTANT: Do NOT give GTO advice. Focus entirely on exploitative play — evaluate each decision based on what is most profitable against THIS specific villain's tendencies and patterns.

Before each of their decisions, the student also tags villain's likely range using these fixed categories:
- Can play for stacks (CPSF) — hands strong enough to get all-in for
- Thick value — strong value hands worth betting big
- Thin value — marginal hands worth a smaller value bet
- Showdown value (SDV) — hands with some equity but not worth betting, just checking down
- Draws — drawing hands with little current equity but outs
- Air — no meaningful equity, pure bluff-catchers/bluffs

Each decision point in the hand summary includes "Hero's range read on villain" listing which categories the student selected for that street.

When coaching:
- Reference the villain's specific tendencies when explaining why a decision is right or wrong
- Be concrete: "Against a Nit, when they bet the turn here, their range is heavily weighted towards value, so your fold with second pair is correct"
- Consider hand strength relative to villain's likely range at each decision point
- Highlight when the student over-folded or over-called against this villain type
- Evaluate the student's range read at each street: did they correctly include/exclude the right categories given the villain type, board texture, and action? Call out any category they missed or shouldn't have included

Structure your response:
1. Walk through each decision point (preflop, then each street reached), one paragraph each — cover both the range read and the action taken
2. **Key exploitative adjustments** — 2–3 specific adjustments for playing against this villain type in future

End with:
---
**Rating: XX/100** — [one sentence]

Scoring: 90–100 = excellent exploitative thinking, 70–89 = good with minor errors, 50–69 = decent but misread villain tendencies, <50 = significant leaks against this villain type.

For follow-up responses, stay in coach mode — answer specifically and concisely, referencing the hand where relevant.`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!process.env.ANTHROPIC_API_KEY) {
    res.write(`data: ${JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set on the server' })}\n\n`);
    return res.end();
  }

  const { history, villainName, villainContext } = req.body;
  const messages: Anthropic.MessageParam[] = (history as Message[]).map(m => ({
    role: m.role, content: m.content,
  }));

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 1800,
      system: buildSystem(villainName, villainContext),
      messages,
    });
    stream.on('text', (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`));
    await stream.finalMessage();
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
}
