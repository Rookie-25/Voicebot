import { useEffect, useReducer, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { UserQuestionSchema } from '@voice-bot/contracts';
import type { ConversationState } from '@voice-bot/contracts';
import { conversationReducer, initialConversation, requestDemoReply } from './conversation/machine';
import { Icon } from './components/Icon';
import { VoiceVisual } from './components/VoiceVisual';
import { ConversationPanel } from './components/ConversationPanel';

const statusLabels: Record<ConversationState, string> = {
  idle: 'Ready when you are',
  listening: 'Listening',
  processing: 'Preparing a demo response',
  speaking: 'Speaking',
  stopped: 'Response stopped',
  error: 'Something needs attention',
};
const suggestions = [
  { icon: 'person', label: 'The introduction', question: 'Tell me about yourself.' },
  { icon: 'project', label: 'Behind the build', question: 'What project are you proud of?' },
  { icon: 'spark', label: 'The way you work', question: 'How do you approach a challenge?' },
] as const;

export function App() {
  const [conversation, dispatch] = useReducer(conversationReducer, initialConversation);
  const [draft, setDraft] = useState('');
  const [audioPreferred, setAudioPreferred] = useState(true);
  const [validation, setValidation] = useState('');
  const active = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = conversation.status === 'processing';

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    const stopOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && active.current) {
        active.current.abort();
        active.current = null;
        dispatch({ type: 'cancel' });
      }
    };
    window.addEventListener('keydown', stopOnEscape);
    return () => window.removeEventListener('keydown', stopOnEscape);
  }, []);

  async function ask(text: string) {
    const candidate = UserQuestionSchema.safeParse({ requestId: crypto.randomUUID(), text });
    if (!candidate.success) {
      setValidation('Enter a question between 1 and 2,000 characters.');
      inputRef.current?.focus();
      return;
    }
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const { requestId } = candidate.data;
    setValidation('');
    setDraft('');
    dispatch({ type: 'submit', requestId, text: candidate.data.text });
    try {
      const reply = await requestDemoReply(candidate.data.text, controller.signal);
      if (!controller.signal.aborted) dispatch({ type: 'resolve', requestId, text: reply });
    } catch {
      if (!controller.signal.aborted) dispatch({ type: 'reject', requestId });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy) void ask(draft);
  }
  function cancel() {
    active.current?.abort();
    active.current = null;
    dispatch({ type: 'cancel' });
    inputRef.current?.focus();
  }
  function reset() {
    active.current?.abort();
    active.current = null;
    dispatch({ type: 'reset' });
    setDraft('');
    setValidation('');
    inputRef.current?.focus();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#question">
        Skip to question
      </a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Persona home">
          <span className="brand-symbol">
            <Icon name="spark" size={24} />
          </span>
          <span>
            persona<span className="brand-period">.</span>
          </span>
        </a>
        <span className="header-label">THE INTERVIEW EXPERIENCE</span>
        <span className="preview-tag">
          <span className="tiny-dot" /> Interface preview
        </span>
      </header>

      <main className="main-content">
        <section className="intro" aria-labelledby="page-title">
          <div className="eyebrow">
            <span /> AI INTERVIEW REPRESENTATIVE
          </div>
          <h1 id="page-title">
            Beyond the résumé.
            <br />
            <span>Into the conversation.</span>
          </h1>
          <p className="intro-description">
            A more natural way to explore background, experience, and ideas.
          </p>
          <VoiceVisual status={conversation.status} />
          <div className={`status status--${conversation.status}`} role="status">
            <span className="status-dot" />
            {statusLabels[conversation.status]}
          </div>
          <p className="voice-disclosure">The finished experience will use a synthetic AI voice.</p>
        </section>

        <div className="workspace">
          <div className="conversation-toolbar">
            <span className="section-kicker">YOUR SPACE TO ASK</span>
            <div className="toolbar-actions">
              <button
                className="quiet-button audio-button"
                type="button"
                aria-pressed={audioPreferred}
                aria-label="Prefer audio responses when available"
                aria-describedby="audio-note"
                onClick={() => setAudioPreferred(!audioPreferred)}
              >
                <Icon name={audioPreferred ? 'volume' : 'mute'} size={17} />
                <span>Audio {audioPreferred ? 'on' : 'off'}</span>
              </button>
              <span className="toolbar-divider" />
              <button
                className="quiet-button"
                type="button"
                onClick={reset}
                aria-label="Reset conversation"
              >
                <Icon name="reset" size={16} />
                <span>Reset</span>
              </button>
            </div>
          </div>
          <span id="audio-note" className="sr-only">
            Audio preference preview only. No sound is played or recorded.
          </span>

          <ConversationPanel conversation={conversation} />

          <div className="composer-area">
            <form className={`composer ${busy ? 'composer--busy' : ''}`} onSubmit={submit}>
              <button
                type="button"
                className="mic-button"
                aria-label="Microphone preview: recording unavailable"
                aria-describedby="demo-note"
                disabled={busy}
                onClick={() => {
                  dispatch({ type: 'microphone-preview' });
                  inputRef.current?.focus();
                }}
              >
                <Icon name="mic" size={21} />
              </button>
              <label htmlFor="question" className="sr-only">
                Your interview question
              </label>
              <textarea
                ref={inputRef}
                id="question"
                name="question"
                rows={1}
                maxLength={2000}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setValidation('');
                }}
                placeholder="Ask a question…"
                aria-describedby={validation ? 'question-error demo-note' : 'demo-note'}
                aria-invalid={!!validation}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (!busy) void ask(draft);
                  }
                }}
              />
              {busy ? (
                <button
                  className="send-button"
                  type="button"
                  aria-label="Stop demo response"
                  onClick={cancel}
                >
                  <Icon name="stop" size={18} />
                </button>
              ) : (
                <button
                  className="send-button"
                  type="submit"
                  aria-label="Ask question"
                  disabled={!draft.trim()}
                >
                  <Icon name="arrow" size={20} />
                </button>
              )}
            </form>
            {validation && (
              <p id="question-error" className="field-error" role="alert">
                {validation}
              </p>
            )}
            <p id="demo-note" className="composer-note">
              Local demo responses <span>·</span> Microphone and voice are unavailable
            </p>
            {conversation.notice && (
              <p className="notice" role={conversation.status === 'error' ? 'alert' : 'status'}>
                {conversation.notice}
              </p>
            )}
          </div>

          <section className="suggestions" aria-labelledby="suggestions-heading">
            <h2 id="suggestions-heading">A few places to start</h2>
            <div className="suggestion-grid">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  className="suggestion"
                  key={suggestion.label}
                  disabled={busy}
                  onClick={() => void ask(suggestion.question)}
                >
                  <span className="suggestion-icon">
                    <Icon name={suggestion.icon} size={17} />
                  </span>
                  <span className="suggestion-content">
                    <span className="suggestion-label">{suggestion.label}</span>
                    <span>{suggestion.question}</span>
                  </span>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <span className="footer-note">
          <Icon name="lock" size={13} /> Your questions stay in this browser during the demo.
        </span>
        <details className="privacy">
          <summary>
            About this preview <span>↗</span>
          </summary>
          <div className="privacy-content">
            <strong>A thoughtful preview.</strong>
            <p>
              Responses are scripted interface examples. They contain no candidate biography and use
              no AI service. Nothing is recorded, played, or saved to browser storage. Refresh or
              reset to clear the conversation.
            </p>
            <p>
              Future approved answers will use a synthetic voice, not the candidate’s recorded
              voice.
            </p>
          </div>
        </details>
      </footer>
    </div>
  );
}
