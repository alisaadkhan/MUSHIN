import { useState, useCallback, MouseEvent } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

export function useMouseSpotlight() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth the motion
  const springX = useSpring(mouseX, { stiffness: 500, damping: 50 });
  const springY = useSpring(mouseY, { stiffness: 500, damping: 50 });

  const onMouseMove = useCallback(({ currentTarget, clientX, clientY }: MouseEvent) => {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }, [mouseX, mouseY]);

  return { mouseX: springX, mouseY: springY, onMouseMove };
}
