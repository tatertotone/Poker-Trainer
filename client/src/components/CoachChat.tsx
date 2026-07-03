import { useRef, useEffect } from 'react';
import type { ChatMessage } from '../types/poker';

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onFollowUp: (message: string) => Promise<void>;
  followUpInput: string;
  onFollowUpChange: (v: string) => void;
}

export default function CoachChat({
  messages,
  isLoading,
  onFollowUp,
  followUpInput,
  onFollowUpChange,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpInput.trim() || isLoading) return;
    await onFollowUp(followUpInput);
  };

  return (
    <div className="coach-chat">
      <div className="messages">
        {messages.length === 0 && (
          <div className="coach-empty">
            <div className="coach-empty-icon">🃏</div>
            <p>Complete all four streets of ranging, then get a full debrief from your AI coach.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-role">
              {msg.role === 'user' ? 'You' : 'Coach'}
            </div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-role">Coach</div>
            <div className="message-content typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length > 0 && (
        <form className="follow-up-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={followUpInput}
            onChange={e => onFollowUpChange(e.target.value)}
            placeholder="Ask a follow-up question..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !followUpInput.trim()}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}
