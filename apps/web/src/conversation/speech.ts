export interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export class BrowserSpeech {
  private recognition: Recognition | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private epoch = 0;
  constructor(
    private callbacks: {
      transcript: (text: string) => void;
      state: (state: 'idle' | 'listening' | 'speaking') => void;
      notice: (message: string) => void;
    },
  ) {}
  supported() {
    const w = window as SpeechWindow;
    return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
  }
  voices() {
    return window.speechSynthesis?.getVoices() ?? [];
  }
  cancel() {
    this.epoch++;
    clearTimeout(this.timer);
    this.recognition?.abort();
    this.recognition = null;
    window.speechSynthesis?.cancel();
    this.callbacks.state('idle');
  }
  listen() {
    this.cancel();
    const w = window as SpeechWindow,
      Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Constructor) {
      this.callbacks.notice(
        'Voice dictation is unavailable in this browser. Please type your question.',
      );
      return;
    }
    const epoch = this.epoch,
      recognition = new Constructor();
    this.recognition = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      if (epoch !== this.epoch) return;
      this.callbacks.transcript(
        Array.from(event.results, (result) => result[0]?.transcript ?? '')
          .join(' ')
          .slice(0, 2000),
      );
    };
    recognition.onerror = (event) => {
      if (epoch !== this.epoch) return;
      this.callbacks.notice(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone permission was denied. You can still type your question.'
          : 'Dictation could not finish. Check your connection or type your question.',
      );
      this.cancel();
    };
    recognition.onend = () => {
      if (epoch !== this.epoch) return;
      this.epoch++;
      clearTimeout(this.timer);
      this.recognition = null;
      this.callbacks.state('idle');
    };
    try {
      recognition.start();
      this.callbacks.state('listening');
      this.timer = setTimeout(() => this.stopListening(), 20_000);
    } catch {
      this.cancel();
      this.callbacks.notice('Microphone could not start. Please type your question.');
    }
  }
  stopListening() {
    clearTimeout(this.timer);
    this.recognition?.stop();
  }
  speak(text: string, voiceURI: string) {
    this.cancel();
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      this.callbacks.notice('Spoken playback is unavailable. You can read the answer below.');
      return;
    }
    const epoch = this.epoch,
      utterance = new SpeechSynthesisUtterance(text);
    const voice =
      this.voices().find((v) => v.voiceURI === voiceURI) ??
      this.voices().find((v) => v.lang.startsWith('en') && v.localService);
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.onstart = () => {
      if (epoch === this.epoch) this.callbacks.state('speaking');
    };
    utterance.onend = () => {
      if (epoch === this.epoch) {
        this.epoch++;
        clearTimeout(this.timer);
        this.callbacks.state('idle');
      }
    };
    utterance.onerror = () => {
      if (epoch === this.epoch) {
        this.cancel();
        this.callbacks.notice('Playback stopped. You can replay or read the answer.');
      }
    };
    try {
      window.speechSynthesis.speak(utterance);
      this.timer = setTimeout(() => {
        if (epoch === this.epoch) {
          this.cancel();
          this.callbacks.notice(
            'Playback stopped. Use Replay if you want to hear the answer again.',
          );
        }
      }, 45_000);
    } catch {
      this.cancel();
      this.callbacks.notice('Your browser could not play audio. Read the answer or try Replay.');
    }
  }
}
