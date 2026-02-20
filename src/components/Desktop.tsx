import { useSettingsStore } from '../stores/settingsStore';


interface DesktopProps {
  children?: React.ReactNode;
}

export const Desktop: React.FC<DesktopProps> = ({ children }) => {
  const wallpaper = useSettingsStore((state) => state.wallpaper);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-zinc-50 pointer-events-none">
      {/* Background Layer */}
      {wallpaper ? (
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-500 ease-in-out"
          style={{ backgroundImage: `url(${wallpaper})` }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-500 ease-in-out"
          style={{ backgroundImage: `url('/Background.png')` }}
        />
      )}

      {/* Dot Pattern - Only show if no wallpaper or if wallpaper has transparency (unlikely for bg) */}
      {!wallpaper && (
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
      )}

      {/* Desktop Icons Context - Rendered above background but below windows */}
      <div className="absolute inset-0 z-10 p-6 pointer-events-auto">
        {/* Children (Desktop Icons if any) */}
        {children}
      </div>
    </div>
  );
};
