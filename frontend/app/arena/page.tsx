'use client';

import dynamic from 'next/dynamic';

const MultiplayerArena = dynamic(() => import('./ArenaClient'), { ssr: false });

export default function ArenaPage() {
  return <MultiplayerArena />;
}
