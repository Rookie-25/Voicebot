import { useEffect, useRef } from 'react';
import type { Conversation } from '../conversation/machine';
import { Icon } from './Icon';

export function ConversationPanel({ conversation }: { conversation: Conversation }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pane = scrollRef.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [conversation.messages, conversation.status]);

  return (
    <section className="conversation" aria-labelledby="conversation-heading">
      <div className="panel-heading">
        <h2 id="conversation-heading">Conversation</h2>
        <span>
          <span className="tiny-dot" /> Local demo
        </span>
      </div>
      <div
        className="messages"
        ref={scrollRef}
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={conversation.status === 'processing'}
        tabIndex={0}
      >
        {conversation.messages.length === 0 ? (
          <div className="welcome">
            <div className="speaker-mark">
              <Icon name="spark" size={18} />
            </div>
            <div>
              <div className="message-byline">
                Your interview representative <span>DEMO</span>
              </div>
              <p>A little curiosity goes a long way.</p>
              <p className="muted">
                Ask about background, projects, or working style. Try a question below to explore
                this interface preview.
              </p>
            </div>
          </div>
        ) : (
          conversation.messages.map((message) => (
            <article
              key={message.id}
              className={`message message--${message.role}`}
              aria-label={message.role === 'visitor' ? 'Your question' : 'Demo response'}
            >
              <div className="message-byline">
                {message.role === 'visitor' ? (
                  'You'
                ) : (
                  <>
                    Interface preview <span>DEMO RESPONSE</span>
                  </>
                )}
              </div>
              <p>{message.text}</p>
            </article>
          ))
        )}
        {conversation.status === 'processing' && (
          <div className="thinking" aria-hidden="true">
            <span />
            <span />
            <span />
            <span className="thinking-label">Preparing a demo response</span>
          </div>
        )}
      </div>
    </section>
  );
}
