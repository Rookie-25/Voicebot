import type { ConversationState } from '@voice-bot/contracts';

export interface Message {
  id: string;
  role: 'visitor' | 'assistant';
  provenance?: string;
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
  | { type: 'resolve'; requestId: string; text: string; provenance?: string }
  | { type: 'reject'; requestId: string; message?: string }
  | { type: 'cancel' }
  | { type: 'reset' }
  | { type: 'speech'; status: 'listening' | 'speaking' | 'idle' }
  | { type: 'notice'; message: string };

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
          {
            id: `${event.requestId}-reply`,
            role: 'assistant',
            text: event.text,
            ...(event.provenance ? { provenance: event.provenance } : {}),
          },
        ],
      };
    case 'reject':
      if (state.activeRequestId !== event.requestId) return state;
      return {
        ...state,
        status: 'error',
        activeRequestId: null,
        notice: event.message ?? 'The answer could not finish. Please try your question again.',
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
    case 'speech':
      return state.status === 'processing' ? state : { ...state, status: event.status };
    case 'notice':
      return { ...state, notice: event.message };
  }
}
