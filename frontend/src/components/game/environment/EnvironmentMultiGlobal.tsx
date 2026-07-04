'use client';

import React, { useState, useEffect } from 'react';
import { StormEnvironment } from './StormEnvironment';

interface EnvironmentMultiGlobalProps {
  settingsRef: React.RefObject<any>;
  debug?: boolean;
  onReady?: () => void;
}

export const EnvironmentMultiGlobal = ({ settingsRef, debug = false, onReady }: EnvironmentMultiGlobalProps) => {
  const [potatoMode, setPotatoMode] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    setPotatoMode(settingsRef.current?.potatoMode);
  }, [settingsRef]);

  return (
    <StormEnvironment
      potatoMode={potatoMode}
      debug={debug}
      onReady={onReady}
    />
  );
};
