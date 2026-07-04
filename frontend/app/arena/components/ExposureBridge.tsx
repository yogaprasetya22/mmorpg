/** Syncs WebGL toneMappingExposure inside the R3F Canvas context. */
'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export const ExposureBridge = ({ exposure }: { exposure: number }) => {
  const { gl } = useThree();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Intentional: mutate WebGLRenderer exposure property
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);

  return null;
};
