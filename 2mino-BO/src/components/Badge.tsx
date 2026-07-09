import type { ReactNode } from 'react';
import './badge.css';

type Tone = 'success' | 'danger' | 'warning' | 'muted' | 'accent';

export default function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`bo-badge bo-badge-${tone}`}>{children}</span>;
}
