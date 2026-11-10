import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

// Counts from 0 to target. Skips straight to the target when reduced motion is on.
export function useCountUp(target, { duration = 1.1, delay = 0.15 } = {}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return undefined;
    }
    const controls = animate(0, target, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, reduce, duration, delay]);

  return value;
}
