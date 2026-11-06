/**
 * Hand-drawn SVG flags. Windows does not render emoji country flags, so every
 * language in Neuro OS gets a real vector flag instead.
 */
import { memo } from 'react';

interface FlagProps {
  code: string;
  size?: number;
  radius?: number;
  className?: string;
  title?: string;
}

const W = 24;
const H = 16;

function Shapes({ code }: { code: string }): JSX.Element {
  switch (code) {
    case 'us':
      return (
        <>
          <rect width={W} height={H} fill="#ffffff" />
          {Array.from({ length: 7 }).map((_, i) => (
            <rect key={i} y={i * (H / 6.5)} width={W} height={H / 13} fill="#b22234" />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <rect key={`w${i}`} y={i * (H / 6.5) + H / 13} width={W} height={H / 13} fill="#ffffff" />
          ))}
          <rect width={10.5} height={H * 0.54} fill="#3c3b6e" />
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3, 4].map((col) => (
              <circle key={`${row}-${col}`} cx={1.2 + col * 2} cy={1.1 + row * 1.9} r={0.42} fill="#ffffff" opacity={0.95} />
            )),
          )}
        </>
      );
    case 'eg':
      return (
        <>
          <rect width={W} height={H} fill="#ffffff" />
          <rect width={W} height={H / 3} fill="#ce1126" />
          <rect y={(H * 2) / 3} width={W} height={H / 3} fill="#0f0f0f" />
          <path d="M12 6.1l.7 1.3 1.4.2-1 1 .2 1.4-1.3-.6-1.3.6.2-1.4-1-1 1.4-.2z" fill="#c09300" />
        </>
      );
    case 'fr':
      return (
        <>
          <rect width={W / 3} height={H} fill="#0055a4" />
          <rect x={W / 3} width={W / 3} height={H} fill="#ffffff" />
          <rect x={(W * 2) / 3} width={W / 3} height={H} fill="#ef4135" />
        </>
      );
    case 'es':
      return (
        <>
          <rect width={W} height={H} fill="#aa151b" />
          <rect y={H / 4} width={W} height={H / 2} fill="#f1bf00" />
          <rect x={5.4} y={6.4} width={1.9} height={3} rx={0.3} fill="#aa151b" opacity={0.9} />
        </>
      );
    case 'de':
      return (
        <>
          <rect width={W} height={H / 3} fill="#000000" />
          <rect y={H / 3} width={W} height={H / 3} fill="#dd0000" />
          <rect y={(H * 2) / 3} width={W} height={H / 3} fill="#ffce00" />
        </>
      );
    case 'cn':
      return (
        <>
          <rect width={W} height={H} fill="#de2910" />
          <path d="M4.6 2.1l.66 1.95h2.06l-1.67 1.2.64 1.95-1.69-1.2-1.68 1.2.64-1.95L1.9 4.05h2.05z" fill="#ffde00" />
          {[
            [8.2, 2.2],
            [9.4, 3.8],
            [9.4, 5.6],
            [8.2, 7.2],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={0.62} fill="#ffde00" />
          ))}
        </>
      );
    case 'jp':
      return (
        <>
          <rect width={W} height={H} fill="#ffffff" />
          <circle cx={W / 2} cy={H / 2} r={4.4} fill="#bc002d" />
        </>
      );
    case 'ru':
      return (
        <>
          <rect width={W} height={H / 3} fill="#ffffff" />
          <rect y={H / 3} width={W} height={H / 3} fill="#0039a6" />
          <rect y={(H * 2) / 3} width={W} height={H / 3} fill="#d52b1e" />
        </>
      );
    case 'br':
      return (
        <>
          <rect width={W} height={H} fill="#009b3a" />
          <path d={`M12 2.3l9 5.7-9 5.7-9-5.7z`} fill="#fedf00" />
          <circle cx={12} cy={8} r={2.9} fill="#002776" />
          <path d="M9.4 7.1c1.7.6 3.4.6 5.2 0 .2 1.4-.3 2.5-1.2 3.1-1.6.2-2.9-.2-4-1.2-.3-.6-.3-1.3 0-1.9z" fill="#ffffff" opacity={0.92} />
        </>
      );
    case 'it':
      return (
        <>
          <rect width={W / 3} height={H} fill="#009246" />
          <rect x={W / 3} width={W / 3} height={H} fill="#ffffff" />
          <rect x={(W * 2) / 3} width={W / 3} height={H} fill="#ce2b37" />
        </>
      );
    case 'tr':
      return (
        <>
          <rect width={W} height={H} fill="#e30a17" />
          <circle cx={9.4} cy={8} r={3.4} fill="#ffffff" />
          <circle cx={10.6} cy={8} r={2.7} fill="#e30a17" />
          <path d="M14.5 8l.62 1.36 1.48-.2-.94 1.14.72 1.3-1.4-.48-1.05 1.05-.06-1.5-1.4-.5 1.32-.72z" fill="#ffffff" transform="translate(-.5 -1.3) scale(.92)" />
        </>
      );
    case 'in':
      return (
        <>
          <rect width={W} height={H / 3} fill="#ff9933" />
          <rect y={H / 3} width={W} height={H / 3} fill="#ffffff" />
          <rect y={(H * 2) / 3} width={W} height={H / 3} fill="#138808" />
          <circle cx={12} cy={8} r={2} fill="none" stroke="#000080" strokeWidth={0.42} />
          <circle cx={12} cy={8} r={0.36} fill="#000080" />
        </>
      );
    case 'kr':
      return (
        <>
          <rect width={W} height={H} fill="#ffffff" />
          <circle cx={12} cy={8} r={3.1} fill="#cd2e3a" />
          <path d="M8.9 8a3.1 3.1 0 0 1 6.2 0 1.55 1.55 0 0 1-3.1 0 1.55 1.55 0 0 0-3.1 0z" fill="#0047a0" />
          {[
            [4.4, 3.4],
            [19.6, 3.4],
            [4.4, 12.6],
            [19.6, 12.6],
          ].map(([x, y], i) => (
            <g key={i} stroke="#000000" strokeWidth={0.5} opacity={0.85}>
              <line x1={x - 1.5} y1={y - 0.55} x2={x + 1.5} y2={y - 0.55} />
              <line x1={x - 1.5} y1={y} x2={x + 1.5} y2={y} />
              <line x1={x - 1.5} y1={y + 0.55} x2={x + 1.5} y2={y + 0.55} />
            </g>
          ))}
        </>
      );
    case 'nl':
      return (
        <>
          <rect width={W} height={H / 3} fill="#ae1c28" />
          <rect y={H / 3} width={W} height={H / 3} fill="#ffffff" />
          <rect y={(H * 2) / 3} width={W} height={H / 3} fill="#21468b" />
        </>
      );
    default:
      return <rect width={W} height={H} fill="#3a3d44" />;
  }
}

export const Flag = memo(function Flag({ code, size = 20, radius = 4, className, title }: FlagProps): JSX.Element {
  const height = size * (H / W);
  const clipId = `flag-${code}-${size}`;
  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={title ?? code}
      style={{ display: 'block', flex: 'none', borderRadius: radius }}
    >
      <title>{title ?? code}</title>
      <defs>
        <clipPath id={clipId}>
          <rect width={W} height={H} rx={radius * (W / size)} ry={radius * (W / size)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <Shapes code={code} />
      </g>
      <rect width={W} height={H} rx={radius * (W / size)} ry={radius * (W / size)} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={0.5} />
    </svg>
  );
});
