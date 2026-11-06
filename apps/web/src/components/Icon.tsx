import type { CSSProperties } from 'react';

type IconName =
  | 'mic'
  | 'arrow'
  | 'reset'
  | 'volume'
  | 'mute'
  | 'person'
  | 'project'
  | 'spark'
  | 'lock'
  | 'stop'
  | 'close';
const paths: Record<IconName, string> = {
  mic: 'M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
  volume: 'M11 5 6 9H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
  mute: 'M11 5 6 9H3v6h3l5 4V5ZM16 9l6 6M22 9l-6 6',
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  project: 'M8 6V3h8v3M3 7h18v14H3V7ZM3 12a22 22 0 0 0 18 0M10 12v3h4v-3',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  lock: 'M6 10h12v11H6V10ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  stop: 'M6 6h12v12H6V6Z',
  close: 'm6 6 12 12M18 6 6 18',
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
