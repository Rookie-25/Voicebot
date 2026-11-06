import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('interface preview', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('labels demo behavior and explains the unavailable microphone', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /microphone preview/i }));
    expect(screen.getByText(/Microphone recording is unavailable/)).toBeVisible();
    expect(screen.getByLabelText('Your interview question')).toHaveFocus();
    expect(screen.getByText(/synthetic AI voice/)).toBeVisible();
  });

  it('accepts a question and renders an explicitly labeled local response', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Your interview question'), {
      target: { value: 'Tell me about yourself.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask question' }));
    expect(screen.getByRole('button', { name: 'Stop demo response' })).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByLabelText('Demo response')).toHaveTextContent('candidate-approved');
    expect(screen.getByText('DEMO RESPONSE')).toBeVisible();
  });

  it('cancels a pending response and suppresses the stale completion', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Tell me about yourself/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop demo response' }));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.queryByLabelText('Demo response')).not.toBeInTheDocument();
    expect(screen.getByText(/Response stopped. Ask another/)).toBeVisible();
  });

  it('resets a pending conversation and keeps it cleared', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /What project are you proud/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset conversation' }));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.queryByLabelText('Your question')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Demo response')).not.toBeInTheDocument();
    expect(screen.getByText('A little curiosity goes a long way.')).toBeVisible();
  });
});
