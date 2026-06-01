import { UnitRuntimeData } from '@/src/core/domain/unit.types';

export interface PlayerProps {
  paused?: boolean;
  modelPath?: string;
  playerClass?: string;
  damageQueue?: React.RefObject<any[]>;
  settingsRef: React.RefObject<any>;
  unitRegistry?: React.RefObject<UnitRuntimeData[]>;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean, isMagic?: boolean, customColor?: string) => void;
  mmSpellsRef?: React.RefObject<any[]>;
  spellsRef?: React.RefObject<any[]>;
  fighterSpellsRef?: React.RefObject<any[]>;
  tankSpellsRef?: React.RefObject<any[]>;
  assassinSpellsRef?: React.RefObject<any[]>;
  simTimeRef?: React.RefObject<number>;
  sendPlayerState?: (state: { x: number; y: number; z: number; rotation: number; animation: string; targetId?: string }) => void;
  playerStats?: any;
  playerStatsRef?: React.RefObject<any>;
}

export interface CastState {
  isCasting: boolean;
  startTime: number;
  totalTime: number;
  fctTime: number;
  vctTime: number;
  target: any;
  context: any;
}
