"use client";

import React, { useMemo } from "react";
import "@/components/common/animations/animations.css";

export default function FloatingBubbles() {
  const bubbles = useMemo(() => {
    return [...Array(20)].map((_, i) => {
      const size = Math.random() * 40 + 20;
      const duration = Math.random() * 20 + 10;
      const delay = Math.random() * 15;
      const left = Math.random() * 100;

      return {
        id: i,
        size,
        duration,
        delay,
        left,
      };
    });
  }, []); // Generated only once, React state independent

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bubbles.map(({ id, size, duration, delay, left }) => (
        <div
          key={id}
          className="absolute rounded-full bg-gradient-to-br from-blue-100 to-blue-300 opacity-60 animate-bubble"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            left: `${left}%`,
            bottom: `-${size}px`,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}
