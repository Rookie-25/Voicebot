import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const reply = () => ({
  requestId: crypto.randomUUID(),
  answer: 'An approved test answer.',
  answerId: 'intro',
  contentVersion: 'fixture-v1',
  fictional: true,
  provider: 'test',
  grounded: true,
  context: 'opaque-signed-context-test',
  followUpAvailable: true,
});
let handleTurn: (init?: RequestInit) => Promise<Response>;
beforeEach(() => {
  handleTurn = async () => Response.json(reply());
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL, init?: RequestInit) =>
      String(url) === '/api/v1/config'
        ? Promise.resolve(Response.json({ available: true, fictional: true, provider: 'test' }))
        : handleTurn(init),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());
async function ready() {
  render(<App />);
  await screen.findByText('Local test provider — not live AI.');
  fireEvent.click(screen.getByRole('button', { name: 'Prefer audio responses when available' }));
}
describe('interview UI with explicitly test-only backend responses', () => {
  it('discloses fiction, synthetic speech and browser processing consent', async () => {
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Start microphone' }));
    expect(screen.getByText(/Enable browser speech processing/)).toBeVisible();
    expect(screen.getByText(/never the candidate’s real voice/)).toBeVisible();
    expect(screen.getByText('Fictional sample')).toBeVisible();
  });
  it('submits real API requests and retains only opaque follow-up context', async () => {
    await ready();
    const requests: unknown[] = [];
    handleTurn = async (init) => {
      requests.push(JSON.parse(init!.body as string));
      return Response.json(reply());
    };
    fireEvent.change(screen.getByLabelText('Your interview question'), {
      target: { value: 'Tell me about yourself.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }));
    expect(await screen.findByLabelText('Interview response')).toHaveTextContent(
      'An approved test answer.',
    );
    expect(screen.getByText('TEST PROVIDER — NOT LIVE AI')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Your interview question'), {
      target: { value: 'Tell me more.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toEqual({
      question: 'Tell me more.',
      length: 'concise',
      context: 'opaque-signed-context-test',
    });
  });
  it('cancels an asynchronous API turn and suppresses late output', async () => {
    await ready();
    let resolve!: (value: Response) => void;
    handleTurn = () =>
      new Promise((r) => {
        resolve = r;
      });
    fireEvent.click(screen.getByRole('button', { name: /Tell me about yourself/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
    await act(async () => resolve(Response.json(reply())));
    expect(screen.queryByLabelText('Interview response')).not.toBeInTheDocument();
    expect(screen.getByText(/Response stopped\. Ask another/)).toBeVisible();
  });
  it('keeps reset conversations empty even if the old request completes', async () => {
    await ready();
    let resolve!: (value: Response) => void;
    handleTurn = () =>
      new Promise((r) => {
        resolve = r;
      });
    fireEvent.click(screen.getByRole('button', { name: /What project are you proud/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset conversation' }));
    await act(async () => resolve(Response.json(reply())));
    expect(screen.queryByLabelText('Your question')).not.toBeInTheDocument();
    expect(screen.getByText('A little curiosity goes a long way.')).toBeVisible();
  });
  it('shows safe service errors instead of fabricating a reply', async () => {
    await ready();
    handleTurn = async () =>
      Response.json(
        {
          error: {
            code: 'UNAVAILABLE',
            message: 'Live answers are unavailable.',
            requestId: crypto.randomUUID(),
            retryable: true,
          },
        },
        { status: 503 },
      );
    fireEvent.click(screen.getByRole('button', { name: /Tell me about yourself/ }));
    expect(await screen.findByText('Live answers are unavailable.')).toBeVisible();
    expect(screen.queryByLabelText('Interview response')).not.toBeInTheDocument();
  });
});
