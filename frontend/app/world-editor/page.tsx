'use client';

import dynamic from 'next/dynamic';

const WorldEditorCanvas = dynamic(
  () => import('@/src/features/world-editor/ui/WorldEditorCanvas').then((m) => ({ default: m.WorldEditorCanvas })),
  { ssr: false },
);

export default function WorldEditorPage() {
  return (
    <main className="fixed inset-0 w-full h-full bg-slate-950 overflow-hidden">
      <WorldEditorCanvas />
    </main>
  );
}
