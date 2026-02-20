import React from 'react';
import { cn } from '../../lib/utils';

interface NeuroIconProps {
  className?: string;
  size?: number;
  showTM?: boolean;
}

export const NeuroIcon: React.FC<NeuroIconProps> = ({ className, size = 24, showTM = true }) => {
  return (
    <div
      className={cn("relative flex items-center justify-center font-light tracking-tighter select-none", className)}
      style={{ width: size, height: size, fontSize: size * 0.8 }}
    >
      <span className="text-current">N</span>
      {showTM && (
        <span
          className="absolute font-bold"
          style={{
            fontSize: size * 0.25,
            top: '5%',
            right: '-10%',
            opacity: 0.8
          }}
        >
          TM
        </span>
      )}
    </div>
  );
};
