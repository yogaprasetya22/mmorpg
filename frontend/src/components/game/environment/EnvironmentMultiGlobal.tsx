'use client';

import React from 'react';
import { StormEnvironment } from './StormEnvironment';

interface EnvironmentMultiGlobalProps {
  settingsRef: React.RefObject<any>;
  debug?: boolean;
  onReady?: () => void;
}

export const EnvironmentMultiGlobal = ({ settingsRef, debug = false, onReady }: EnvironmentMultiGlobalProps) => {
  return (
    <StormEnvironment
      potatoMode={settingsRef?.current?.potatoMode}
      debug={debug}
      onReady={onReady}
    />
  );
};
