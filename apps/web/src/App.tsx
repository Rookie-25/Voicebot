import { useEffect, useReducer, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { UserQuestionSchema } from '@voice-bot/contracts';
import type { ConversationState } from '@voice-bot/contracts';
import { conversationReducer, initialConversation } from './conversation/machine';
import { loadConfig, requestTurn } from './conversation/api';
import { BrowserSpeech } from './conversation/speech';
import { Icon } from './components/Icon';
import { VoiceVisual } from './components/VoiceVisual';
import { ConversationPanel } from './components/ConversationPanel';

const statusLabels: Record<ConversationState, string> = {
  idle: 'Ready when you are',
  listening: 'Listening',
  processing: 'Finding an approved answer',
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
  const [config, setConfig] = useState({
    available: false,
    fictional: true,
    provider: 'disabled' as 'disabled' | 'openai' | 'test',
  });
  const [length, setLength] = useState<'concise' | 'standard'>('concise');
  const [consent, setConsent] = useState(false);
  const [voice, setVoice] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [lastAnswer, setLastAnswer] = useState('');
  const context = useRef<string | undefined>(undefined);
  const preferences = useRef({ audio: true, voice: '' });
  const speech = useRef<BrowserSpeech | null>(null);
  if (!speech.current)
    speech.current = new BrowserSpeech({
      transcript: setDraft,
      state: (status) => dispatch({ type: 'speech', status }),
      notice: (message) => dispatch({ type: 'notice', message }),
    });
  const active = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = conversation.status === 'processing';
  const listening = conversation.status === 'listening';
  const speaking = conversation.status === 'speaking';

  useEffect(() => {
    const controller = new AbortController();
    void loadConfig(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setConfig(value);
          if (!value.available)
            dispatch({
              type: 'notice',
              message:
                'Live answers are not enabled yet. You can still dictate or draft a question.',
            });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          dispatch({
            type: 'notice',
            message: 'The service could not be reached. Check your connection and reload.',
          });
      });
    const update = () => setVoices(speech.current!.voices());
    update();
    window.speechSynthesis?.addEventListener('voiceschanged', update);
    return () => {
      controller.abort();
      speech.current?.cancel();
      window.speechSynthesis?.removeEventListener('voiceschanged', update);
    };
  }, []);

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    const stopOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        speech.current?.cancel();
        if (!active.current) {
          dispatch({ type: 'cancel' });
          return;
        }
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
    speech.current?.cancel();
    const controller = new AbortController();
    active.current = controller;
    const { requestId } = candidate.data;
    setValidation('');
    setDraft('');
    dispatch({ type: 'submit', requestId, text: candidate.data.text });
    try {
      const reply = await requestTurn(
        {
          question: candidate.data.text,
          length,
          ...(context.current ? { context: context.current } : {}),
        },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        context.current = reply.context;
        setLastAnswer(reply.answer);
        dispatch({
          type: 'resolve',
          requestId,
          text: reply.answer,
          provenance:
            reply.provider === 'test'
              ? 'TEST PROVIDER — NOT LIVE AI'
              : reply.fictional
                ? 'FICTIONAL APPROVED SAMPLE'
                : reply.grounded
                  ? 'APPROVED ANSWER'
                  : 'UNSUPPORTED QUESTION',
        });
        if (reply.fictional) setConfig((previous) => ({ ...previous, fictional: true }));
        if (preferences.current.audio)
          speech.current?.speak(reply.answer, preferences.current.voice);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        dispatch({
          type: 'reject',
          requestId,
          message:
            error instanceof Error
              ? error.message
              : 'The answer could not finish. Please try again.',
        });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy && !listening && config.available) void ask(draft);
  }
  function cancel() {
    speech.current?.cancel();
    active.current?.abort();
    active.current = null;
    dispatch({ type: 'cancel' });
    inputRef.current?.focus();
  }
  function reset() {
    speech.current?.cancel();
    context.current = undefined;
    setLastAnswer('');
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
          <span className="tiny-dot" />{' '}
          {config.fictional ? 'Fictional sample' : 'Approved candidate'}
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
          <p className="voice-disclosure">
            AI representation · Synthetic browser voice, never the candidate’s real voice.
          </p>
          <p className="composer-note">
            {config.provider === 'test'
              ? 'Local test provider — not live AI.'
              : !config.available
                ? 'Live answers await configuration.'
                : config.fictional
                  ? 'Fictional sample content — this is not the owner’s biography.'
                  : 'Answers use candidate-approved information.'}
          </p>
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
                onClick={() => {
                  const next = !audioPreferred;
                  setAudioPreferred(next);
                  preferences.current.audio = next;
                  if (!next) speech.current?.cancel();
                }}
              >
                <Icon name={audioPreferred ? 'volume' : 'mute'} size={17} />
                <span>Audio {audioPreferred ? 'on' : 'off'}</span>
              </button>
              <span className="toolbar-divider" />
              {lastAnswer && (
                <button
                  className="quiet-button"
                  type="button"
                  disabled={busy || listening}
                  onClick={() => speech.current?.speak(lastAnswer, preferences.current.voice)}
                  aria-label="Replay answer"
                >
                  Replay
                </button>
              )}
              {(speaking || listening) && (
                <button
                  className="quiet-button"
                  type="button"
                  onClick={cancel}
                  aria-label="Stop speech and recording"
                >
                  Stop
                </button>
              )}
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
            Answers can be read aloud with an available synthetic browser voice.
          </span>

          <ConversationPanel conversation={conversation} />

          <div className="composer-area">
            <form className={`composer ${busy ? 'composer--busy' : ''}`} onSubmit={submit}>
              <button
                type="button"
                className="mic-button"
                aria-label={listening ? 'Stop listening' : 'Start microphone'}
                aria-describedby="demo-note"
                disabled={busy}
                onClick={() => {
                  if (listening) {
                    speech.current?.stopListening();
                    return;
                  }
                  if (!consent) {
                    setValidation(
                      'Enable browser speech processing in Audio preferences before using the microphone.',
                    );
                    return;
                  }
                  speech.current?.listen();
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
                readOnly={listening}
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
                    if (!busy && !listening && config.available) void ask(draft);
                  }
                }}
              />
              {busy ? (
                <button
                  className="send-button"
                  type="button"
                  aria-label="Stop response"
                  onClick={cancel}
                >
                  <Icon name="stop" size={18} />
                </button>
              ) : (
                <button
                  className="send-button"
                  type="submit"
                  aria-label="Ask question"
                  disabled={!draft.trim() || listening || !config.available}
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
              Dictate, review, then ask <span>·</span> Typed questions always work when answers are
              enabled
            </p>
            <details className="audio-preferences">
              <summary>Audio preferences & answer length</summary>
              <div className="preference-fields">
                <label>
                  Answer length
                  <select
                    value={length}
                    onChange={(e) => setLength(e.target.value as 'concise' | 'standard')}
                  >
                    <option value="concise">Concise</option>
                    <option value="standard">Standard</option>
                  </select>
                </label>
                <label>
                  Synthetic voice
                  <select
                    value={voice}
                    onChange={(e) => {
                      setVoice(e.target.value);
                      preferences.current.voice = e.target.value;
                    }}
                  >
                    <option value="">Browser default</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="speech-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      if (!e.target.checked) speech.current?.cancel();
                    }}
                  />
                  Allow my browser’s speech service to process microphone audio. Review text before
                  sending.
                </label>
              </div>
            </details>
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
                  disabled={busy || listening || !config.available}
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
          <Icon name="lock" size={13} /> Approved answers · No recordings stored by this app
        </span>
        <details className="privacy">
          <summary>
            About this preview <span>↗</span>
          </summary>
          <div className="privacy-content">
            <strong>Clear about your privacy.</strong>
            <p>
              When enabled, questions and approved public knowledge are processed by the server and
              OpenAI to select an approved answer. We do not save transcripts or recordings by
              default. Conversation context stays in memory; reset clears it. Browser recognition
              may send audio to its own speech service. Support and voice quality vary by browser
              and device.
            </p>
            <p>
              Speech is synthetic, not the candidate’s recorded voice. Provider and browser-service
              retention policies apply. The fictional sample represents no real candidate history.
            </p>
          </div>
        </details>
      </footer>
    </div>
  );
}
