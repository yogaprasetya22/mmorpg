'use client';

import React from 'react';
import { useStore } from '@/src/state/useStore';
import { StormEnvironment } from './StormEnvironment';
import { WhimsicalDiorama } from './WhimsicalDiorama';

interface EnvironmentMultiGlobalProps {
  settingsRef: React.RefObject<any>;
  debug?: boolean;
  onReady?: () => void;
}

export const EnvironmentMultiGlobal = ({ settingsRef, debug = false, onReady }: EnvironmentMultiGlobalProps) => {
  const environment = useStore((s) => s.environment);

  return environment === 'DIORAMA' ? (
    <WhimsicalDiorama
      settingsRef={settingsRef}
      debug={debug}
      onReady={onReady}
    />
  ) : (
    <StormEnvironment
      potatoMode={settingsRef?.current?.potatoMode}
      debug={debug}
      onReady={onReady}
    />
  );
};
