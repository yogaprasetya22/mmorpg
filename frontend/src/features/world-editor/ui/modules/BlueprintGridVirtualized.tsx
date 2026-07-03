'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, memo } from 'react';
import type { AssetBlueprint } from '@/src/features/world-editor/types/editor.types';

import { API_BASE_URL } from '@/src/core/config';

type Props = {
  blueprints: AssetBlueprint[];
  selectedBlueprintId: string | null;
  onSelect: (id: string) => void;
  onHover?: (blueprint: AssetBlueprint | null) => void;
};

export const BlueprintGridVirtualized = memo(({ blueprints, selectedBlueprintId, onSelect, onHover }: Props) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const COLUMNS = 3;
  const rowCount = Math.ceil(blueprints.length / COLUMNS);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68, // Height of each row (row height + gap)
    overscan: 3,
  });

  return (
    <div
      ref={parentRef}
      className="max-h-44 overflow-y-auto custom-scrollbar bg-zinc-900/20 rounded-xl p-1.5 border border-zinc-900 pr-0.5"
    >
      {blueprints.length === 0 ? (
        <div className="py-8 text-center text-zinc-650 text-[8.5px] italic">
          No blueprints found.
        </div>
      ) : (
        <div
          className="w-full relative"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIdx = virtualRow.index * COLUMNS;
            const rowItems = blueprints.slice(startIdx, startIdx + COLUMNS);

            return (
              <div
                key={virtualRow.index}
                className="absolute top-0 left-0 w-full grid grid-cols-3 gap-1.5"
                style={{
                  height: '62px',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {rowItems.map((bp) => {
                  const isSelected = selectedBlueprintId === bp.id;
                  const thumbSrc = bp.thumbnailUrl ? `${API_BASE_URL}${bp.thumbnailUrl}` : null;
                  return (
                    <div
                      key={bp.id}
                      onClick={() => onSelect(bp.id)}
                      onMouseEnter={() => onHover?.(bp)}
                      className={`p-1 border rounded-lg flex flex-col items-center justify-center gap-1 transition-all cursor-pointer truncate ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/[0.04] shadow-[0_0_10px_rgba(99,102,241,0.15)]'
                          : 'border-zinc-900 bg-zinc-950/20 hover:border-zinc-800'
                      }`}
                      style={{ height: '58px' }}
                    >
                      <div className="w-full rounded bg-zinc-950 flex items-center justify-center overflow-hidden border border-zinc-900">
                        {thumbSrc ? (
                          <img src={thumbSrc} alt={bp.name} className="w-full h-full object-contain pointer-events-none" />
                        ) : (
                          <span className="text-xs">📦</span>
                        )}
                      </div>
                      <span className="text-[6.5px] font-black truncate max-w-full text-zinc-400 uppercase px-0.5">
                        {bp.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

BlueprintGridVirtualized.displayName = 'BlueprintGridVirtualized';
