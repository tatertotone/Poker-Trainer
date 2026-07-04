import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Message { role: 'user' | 'assistant'; content: string; }

function buildSystem(villainName?: string, villainContext?: string): string {
  const vs = villainName && villainContext
    ? `\n\nVILLAIN TYPE: ${villainName}\n${villainContext}\n`
    : '';
  return `You are an expert poker coach specialising in exploitative play against specific player types. The student is practising making in-game decisions as the hero, then getting feedback on whether their decisions were exploitatively correct against a specific villain type.${vs}
IMPORTANT: Do NOT give GTO advice. Focus entirely on exploitative play — evaluate each decision based on what is most profitable against THIS specific villain's tendencies and patterns.

When coaching:
- Reference the villain's specific tendencies when explaining why a decision is right or wrong
- Be concrete: "Against a Nit, when they bet the turn here, their range is heavily weighted towards value, so your fold with second pair is correct"
- Consider hand strength relative to villain's likely range at each decision point
- Highlight when the student over-folded or over-called against this villain type

Structure your response:
1. Walk through each decision point (preflop, then each street reached), one paragraph each
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

  const { history, villainName, villainContext } = req.body;
  const messages: Anthropic.MessageParam[] = (history as Message[]).map(m => ({
    role: m.role, content: m.content,
  }));

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
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
    res.write(`data: ${JSON.stringify({ error: 'Failed to reach Claude' })}\n\n`);
    res.end();
  }
}
