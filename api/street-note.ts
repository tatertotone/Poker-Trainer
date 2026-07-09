import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystem(villainName?: string, villainContext?: string): string {
  const vs = villainName && villainContext ? ` The villain is a ${villainName}: ${villainContext}` : '';
  return `You are an expert poker coach evaluating a student's range assignment for a single street.${vs}
The student describes their range using hand categories (e.g. "Overpairs", "Top pair (good kicker)", "Gutshots") rather than specific combos.
Write 2–4 sentences only. Evaluate whether the included and excluded categories make sense given board texture and action. Name specific hands within the categories where it adds insight.
Focus on the single most important correct call or error for this street.
Do not greet or introduce yourself. Output only the coaching note, nothing else.`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    street, villainPosition, heroPosition, heroIsIP,
    actions, board, playerRange, previousRanges,
    villainName, villainContext,
  } = req.body;

  const prevRangeText = (previousRanges as { street: string; range: string[] }[])
    .map(r => `After ${r.street}: [${r.range.join(', ') || 'nothing'}]`)
    .join('\n');

  const prompt = `STREET: ${street.toUpperCase()}
Hero: ${heroPosition} (${heroIsIP ? 'IP' : 'OOP'}) | Villain: ${villainPosition}
Board: ${board || 'none yet'}
Action: ${actions}
${prevRangeText ? `\nPrevious ranges:\n${prevRangeText}\n` : ''}
Student's range after ${street}: [${(playerRange as string[]).join(', ') || 'nothing selected'}]

Evaluate the student's range assignment for this street.`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 300,
      system: buildSystem(villainName, villainContext),
      messages: [{ role: 'user', content: prompt }],
    });
    const note = msg.content[0].type === 'text' ? msg.content[0].text : '';
    res.json({ note });
  } catch (err) {
    console.error(err);
    res.json({ note: '' });
  }
}
