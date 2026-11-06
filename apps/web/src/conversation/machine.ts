import type { ConversationState } from '@voice-bot/contracts';

export interface Message {
  id: string;
  role: 'visitor' | 'demo';
  text: string;
}
export interface Conversation {
  status: ConversationState;
  activeRequestId: string | null;
  messages: Message[];
  notice: string;
}
export type ConversationEvent =
  | { type: 'submit'; requestId: string; text: string }
  | { type: 'resolve'; requestId: string; text: string }
  | { type: 'reject'; requestId: string }
  | { type: 'cancel' }
  | { type: 'reset' }
  | { type: 'microphone-preview' };

export const initialConversation: Conversation = {
  status: 'idle',
  activeRequestId: null,
  messages: [],
  notice: '',
};

export function conversationReducer(state: Conversation, event: ConversationEvent): Conversation {
  switch (event.type) {
    case 'submit':
      return {
        status: 'processing',
        activeRequestId: event.requestId,
        messages: [
          ...state.messages.slice(-19),
          { id: event.requestId, role: 'visitor', text: event.text },
        ],
        notice: '',
      };
    case 'resolve':
      if (state.status !== 'processing' || state.activeRequestId !== event.requestId) return state;
      return {
        ...state,
        status: 'idle',
        activeRequestId: null,
        messages: [
          ...state.messages,
          { id: `${event.requestId}-reply`, role: 'demo', text: event.text },
        ],
      };
    case 'reject':
      if (state.activeRequestId !== event.requestId) return state;
      return {
        ...state,
        status: 'error',
        activeRequestId: null,
        notice: 'The preview could not finish. Please try your question again.',
      };
    case 'cancel':
      return {
        ...state,
        status: 'stopped',
        activeRequestId: null,
        notice: 'Response stopped. Ask another question whenever you’re ready.',
      };
    case 'reset':
      return { ...initialConversation };
    case 'microphone-preview':
      return {
        ...state,
        notice:
          'Microphone recording is unavailable in this preview. Type a question or choose a suggestion below.',
      };
  }
}

// These are interface messages, never candidate facts or approved answers.
export function demoReply(question: string): string {
  if (/project|build|technical/i.test(question))
    return 'A project story belongs here: the context, the candidate’s contribution, and a verified outcome. This local demo shows the conversation flow; candidate-approved project details will be added separately.';
  if (/style|team|work|challenge/i.test(question))
    return 'This is where an approved working-style or challenge story will appear, with a relevant example and room for follow-up questions. This preview contains no candidate experiences.';
  return 'Thanks for the question. A concise, candidate-approved answer will appear here in the finished experience. For now, this local demo lets you try asking, following up, and stopping a response.';
}

export function requestDemoReply(question: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Cancelled', 'AbortError'));
      return;
    }
    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(demoReply(question));
    }, 950);
    signal.addEventListener('abort', abort, { once: true });
  });
}
