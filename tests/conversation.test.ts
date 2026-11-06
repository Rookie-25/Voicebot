import { describe, expect, it } from 'vitest';
import { conversationReducer, initialConversation } from '../apps/web/src/conversation/machine';

describe('conversation state machine', () => {
  it('ignores an older response after a newer request starts', () => {
    const first = conversationReducer(initialConversation, {
      type: 'submit',
      requestId: 'first',
      text: 'One',
    });
    const second = conversationReducer(first, { type: 'submit', requestId: 'second', text: 'Two' });
    expect(
      conversationReducer(second, { type: 'resolve', requestId: 'first', text: 'stale' }),
    ).toBe(second);
  });
  it('ignores completions after cancellation and reset', () => {
    const pending = conversationReducer(initialConversation, {
      type: 'submit',
      requestId: 'first',
      text: 'One',
    });
    for (const type of ['cancel', 'reset'] as const) {
      const stopped = conversationReducer(pending, { type });
      expect(
        conversationReducer(stopped, { type: 'resolve', requestId: 'first', text: 'stale' }),
      ).toBe(stopped);
    }
  });
  it('limits retained history and provides a recoverable error state', () => {
    let state = initialConversation;
    for (let i = 0; i < 30; i++) {
      state = conversationReducer(state, {
        type: 'submit',
        requestId: String(i),
        text: 'Question',
      });
      state = conversationReducer(state, { type: 'resolve', requestId: String(i), text: 'Demo' });
    }
    expect(state.messages.length).toBeLessThanOrEqual(21);
    state = conversationReducer(state, { type: 'submit', requestId: 'last', text: 'Question' });
    expect(conversationReducer(state, { type: 'reject', requestId: 'last' }).status).toBe('error');
  });
});
