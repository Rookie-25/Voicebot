import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BrowserSpeech, type Recognition } from './speech';
const recognizers: Recognition[] = [];
const latest = () => recognizers[recognizers.length - 1]!;
let synth: {
  cancel: ReturnType<typeof vi.fn>;
  speak: ReturnType<typeof vi.fn>;
  getVoices: () => never[];
};
class Utterance {
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  constructor(public text: string) {}
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'SpeechRecognition',
    class {
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: Recognition['onresult'] = null;
      onerror: Recognition['onerror'] = null;
      onend: Recognition['onend'] = null;
      constructor() {
        recognizers.push(this);
      }
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
    },
  );
  synth = { cancel: vi.fn(), speak: vi.fn((u: Utterance) => u.onstart?.()), getVoices: () => [] };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup() {
  const callbacks = { state: vi.fn(), transcript: vi.fn(), notice: vi.fn() };
  return { callbacks, speech: new BrowserSpeech(callbacks) };
}
it('shows transcripts, limits listening and discards callbacks after cancel', () => {
  const { speech, callbacks } = setup();
  speech.listen();
  latest().onresult!({ results: [[{ transcript: 'A question?' }]] });
  expect(callbacks.transcript).toHaveBeenCalledWith('A question?');
  vi.advanceTimersByTime(20000);
  expect(latest().stop).toHaveBeenCalled();
  speech.cancel();
  latest().onresult!({ results: [[{ transcript: 'stale' }]] });
  expect(callbacks.transcript).toHaveBeenCalledTimes(1);
});
it('recovers from microphone denial with typed fallback', () => {
  const { speech, callbacks } = setup();
  speech.listen();
  latest().onerror!({ error: 'not-allowed' });
  expect(callbacks.notice).toHaveBeenCalledWith(expect.stringContaining('permission was denied'));
  expect(latest().abort).toHaveBeenCalled();
});
it('prevents overlapping playback, supports stop/replay and ignores stale speech completion', () => {
  const { speech, callbacks } = setup();
  speech.speak('Approved answer', '');
  const old = synth.speak.mock.calls[0]![0] as Utterance;
  speech.speak('Next approved answer', '');
  const before = callbacks.state.mock.calls.length;
  old.onend?.();
  expect(callbacks.state.mock.calls).toHaveLength(before);
  expect(synth.cancel).toHaveBeenCalledTimes(2);
  speech.cancel();
  expect(synth.cancel).toHaveBeenCalledTimes(3);
});
