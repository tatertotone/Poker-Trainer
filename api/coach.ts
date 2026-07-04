import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Message { role: 'user' | 'assistant'; content: string; }

function buildSystem(villainName?: string, villainContext?: string): string {
  const vs = villainName && villainContext
    ? `\n\nVILLAIN TYPE: ${villainName}\n${villainContext}\nKeep this villain profile in mind — it should heavily influence your analysis.\n`
    : '';
  return `You are an expert poker coach specialising in range construction for Texas Hold'em. You are coaching an intermediate player practising putting opponents on ranges street by street.${vs}
The student will send you a hand summary containing:
- The full hand action (preflop through river)
- The villain's position and whether they are IP or OOP
- The student's range assignment for villain after EACH street, expressed as hand categories
- Per-street coaching notes (your own earlier analysis of each street in isolation)

Evaluate whether the hand categories make sense given board texture, action, and villain type. Reference specific hands within those categories where relevant.

Structure your response:
1. **Preflop range** — Was it reasonable for villain's position and sizing?
2. **Flop narrowing** — Did the student correctly remove hands?
3. **Turn narrowing** — Same analysis for turn.
4. **River narrowing** — Final narrowing quality.
5. **Key takeaways** — 2–3 specific concepts to study.

End with:
---
**Rating: XX/100** — [one sentence explaining the score]

Scoring: 90–100 near-perfect, 70–89 good with minor mistakes, 50–69 decent but gaps, <50 significant misunderstanding. Be honest.

If a student makes a compelling follow-up argument that genuinely changes your assessment:
**Updated Rating: XX/100** — [reason]

Be direct and specific. Reference concrete hands by name. Keep the tone like a knowledgeable friend.`;
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

  const { mode, summary, history, perStreetNotes, villainName, villainContext } = req.body;
  const messages: Anthropic.MessageParam[] = (history as Message[]).map(m => ({
    role: m.role, content: m.content,
  }));

  if (mode === 'debrief' && messages.length === 1) {
    let content = `Please review my range assignments for this hand:\n\n${summary}`;
    if (perStreetNotes?.some((n: string) => n.trim())) {
      content += '\n\n---\nPER-STREET COACHING NOTES:\n';
      const labels = ['Preflop', 'Flop', 'Turn', 'River'];
      (perStreetNotes as string[]).forEach((note, i) => {
        if (note.trim()) content += `\n${labels[i]}: ${note}`;
      });
      content += '\n\nPlease review these notes for accuracy given the full hand context, then give your final structured debrief.';
    }
    messages[0] = { role: 'user', content };
  }

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
