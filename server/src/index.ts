import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CoachRequest {
  mode: 'debrief' | 'followup';
  summary: string;
  history: Message[];
  perStreetNotes?: string[];
  villainName?: string;
  villainContext?: string;
}

interface StreetNoteRequest {
  street: string;
  villainPosition: string;
  heroPosition: string;
  heroIsIP: boolean;
  actions: string;
  board: string;
  playerRange: string[];
  previousRanges: { street: string; range: string[] }[];
  villainName?: string;
  villainContext?: string;
}

// ── System prompt builders ────────────────────────────────────────────────────

function buildDebriefSystem(villainName?: string, villainContext?: string): string {
  const villainSection = villainName && villainContext
    ? `\n\nVILLAIN TYPE: ${villainName}\n${villainContext}\nKeep this villain profile in mind throughout your entire analysis — it should heavily influence which hands you expect to be in their range on each street and how you evaluate the student's narrowing decisions.\n`
    : '';

  return `You are an expert poker coach specialising in range construction for Texas Hold'em. You are coaching an intermediate player who is practising putting opponents on ranges street by street.${villainSection}
The student will send you a hand summary containing:
- The full hand action (preflop through river)
- The villain's position and whether they are IP or OOP
- The student's range assignment for villain after EACH street, expressed as hand categories (e.g. "Overpairs", "Top pair (good kicker)", "Strong draws (OESD / nut flush draw)") rather than specific combos
- Per-street coaching notes (your own earlier analysis of each street in isolation)

Evaluate whether the hand categories the student included or excluded make sense given the board texture, action, and villain type. Reference specific hands within those categories where relevant (e.g. "Overpairs is correct — JJ/TT are definitely in range here, but QQ is borderline given the preflop sizing").

Your job is to give a thorough but conversational debrief. First, briefly review your per-street notes for any errors or inconsistencies given the full hand context, then present your final analysis. Structure your response like this:

1. **Preflop range** — Was it reasonable for villain's position and sizing? What key hands should/shouldn't be there?
2. **Flop narrowing** — Did the student correctly remove hands that wouldn't take villain's flop action? What did they miss?
3. **Turn narrowing** — Same analysis for the turn card and action.
4. **River narrowing** — Final narrowing quality.
5. **Key takeaways** — 2–3 specific concepts the student should study (e.g. "villain checks back strong hands on paired boards", "OOP c-bet range is polarised").

Then end with a horizontal rule and a rating on its own line in EXACTLY this format (no deviation):
---
**Rating: XX/100** — [one sentence explaining the score]

Scoring guide: 90–100 = near-perfect narrowing, very few errors. 70–89 = good work with minor mistakes. 50–69 = decent but meaningful gaps. Below 50 = significant misunderstanding of range dynamics. Be honest and calibrated — do not inflate scores.

If a student makes a compelling argument in a follow-up that genuinely changes your assessment of their range work, include this line in your response (ONLY when the rating actually changes):
**Updated Rating: XX/100** — [reason for the change]

Be direct and specific. Reference concrete hands by name (e.g. "You kept JJ in but villain would almost never check-raise JJ on a T-high board"). Keep the tone like a knowledgeable friend, not a textbook.

For follow-up questions, stay in coach mode — answer specifically and concisely, referencing the hand where relevant.`;
}

function buildStreetNoteSystem(villainName?: string, villainContext?: string): string {
  const villainSection = villainName && villainContext
    ? ` The villain is a ${villainName}: ${villainContext}`
    : '';

  return `You are an expert poker coach evaluating a student's range assignment for a single street.${villainSection}
The student describes their range using hand categories (e.g. "Overpairs", "Top pair (good kicker)", "Gutshots") rather than specific combos.
Write 2–4 sentences only. Evaluate whether the included and excluded categories make sense given board texture and action. Name specific hands within the categories where it adds insight.
Focus on the single most important correct call or error for this street.
Do not greet or introduce yourself. Output only the coaching note, nothing else.`;
}

// ── POST /api/street-note ─────────────────────────────────────────────────────

app.post('/api/street-note', async (req, res) => {
  const {
    street, villainPosition, heroPosition, heroIsIP,
    actions, board, playerRange, previousRanges,
    villainName, villainContext,
  } = req.body as StreetNoteRequest;

  const prevRangeText = previousRanges.map(r =>
    `After ${r.street}: [${r.range.join(', ') || 'nothing'}]`
  ).join('\n');

  const prompt = `STREET: ${street.toUpperCase()}
Hero: ${heroPosition} (${heroIsIP ? 'IP' : 'OOP'}) | Villain: ${villainPosition}
Board: ${board || 'none yet'}
Action: ${actions}
${prevRangeText ? `\nPrevious ranges:\n${prevRangeText}\n` : ''}
Student's range after ${street}: [${playerRange.join(', ') || 'nothing selected'}]

Evaluate the student's range assignment for this street.`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      system: buildStreetNoteSystem(villainName, villainContext),
      messages: [{ role: 'user', content: prompt }],
    });

    const note = msg.content[0].type === 'text' ? msg.content[0].text : '';
    res.json({ note });
  } catch (err) {
    console.error('street-note error:', err);
    res.json({ note: '' });
  }
});

// ── POST /api/coach ───────────────────────────────────────────────────────────

app.post('/api/coach', async (req, res) => {
  const { mode, summary, history, perStreetNotes, villainName, villainContext } =
    req.body as CoachRequest;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const messages: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role,
    content: m.content,
  }));

  if (mode === 'debrief' && messages.length === 1) {
    let content = `Please review my range assignments for this hand:\n\n${summary}`;

    if (perStreetNotes && perStreetNotes.some(n => n.trim())) {
      content += '\n\n---\nPER-STREET COACHING NOTES (your earlier analysis of each street in isolation):\n';
      const labels = ['Preflop', 'Flop', 'Turn', 'River'];
      perStreetNotes.forEach((note, i) => {
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
      system: buildDebriefSystem(villainName, villainContext),
      messages,
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    await stream.finalMessage();
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: 'Failed to reach Claude' })}\n\n`);
    res.end();
  }
});

// ── POST /api/decision-coach ──────────────────────────────────────────────────

function buildDecisionSystem(villainName?: string, villainContext?: string): string {
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

app.post('/api/decision-coach', async (req, res) => {
  const { history, villainName, villainContext } = req.body as {
    history: Message[];
    villainName?: string;
    villainContext?: string;
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const messages: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role, content: m.content,
  }));

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1800,
      system: buildDecisionSystem(villainName, villainContext),
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
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
