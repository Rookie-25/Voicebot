import type { ConversationState } from '@voice-bot/contracts';

export function VoiceVisual({ status }: { status: ConversationState }) {
  return (
    <div className={`voice-visual voice-visual--${status}`} aria-hidden="true">
      <div className="orbit orbit--outer" />
      <div className="orbit orbit--inner" />
      <span className="orbit-tick tick--left" />
      <span className="orbit-tick tick--right" />
      <div className="voice-core">
        <div className="waveform">
          {Array.from({ length: 13 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
