// REFACTORED FROM: ClassCombatEngine.ts
// Shared combat types — CombatExecutionContext, UnitRuntimeData, ClassCombatStrategy interfaces.
import type React from 'react';
import * as THREE from 'three';

export interface CombatExecutionContext {
  charPos: THREE.Vector3;
  originVec: THREE.Vector3;
  camDir: THREE.Vector3;
  combo: number;
  playerStats: any;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean, isMagic?: boolean, customColor?: string) => void;
  spawnVFX: (pos: [number, number, number], type: string, color: string) => void;
  camera: any;
  simTimeRef?: { current: number };
  mmSpellsRef?: { current: any[] };
  mmSpellPtr: { current: number };
  fighterSpellsRef?: { current: any[] };
  fighterSpellPtr: { current: number };
  assassinSpellsRef?: { current: any[] };
  assassinSpellPtr: { current: number };
  tankSpellsRef?: { current: any[] };
  tankSpellPtr: { current: number };
  spellsRef?: { current: any[] };
  spellsPtr: { current: number };
  poolRef?: { current: any };
  grid: any;
  ecctrlRef?: { current: any };
  cameraShake?: (intensity: number) => void;
  /** Skill ID to route to the correct skill execution (archer multi-skill system) */
  skillId?: string;
  /** Reference to player stats for buff skills (Improve Concentration etc.) */
  playerStatsRef?: React.RefObject<any>;
  /** Damage queue for DamageHUD integration */
  damageQueue?: React.RefObject<any[]>;
  /** Unit registry for AoE target queries */
  unitRegistry?: React.RefObject<any[]>;
}

export interface UnitRuntimeData {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  isDying: boolean;
  hp: number;
  maxHp: number;
  position: [number, number, number];
  level: number;
  poolIdx: number;
  defense?: number;
}

export interface ClassCombatStrategy {
  comboColors: string[];
  bulletSpeeds: number[];
  muzzleVFX: string;
  isMelee: boolean;
  
  executeAttack: (target: UnitRuntimeData | null, ctx: CombatExecutionContext) => void;
  executeSkill: (target: UnitRuntimeData | null, ctx: CombatExecutionContext, skillId?: string) => void;
}
