import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action?: () => void;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = React.useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay on screen
  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - 320);

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 min-w-[230px] bg-[#1e1e20] text-gray-200 border border-[#3e3e42] rounded shadow-2xl py-1 text-xs select-none backdrop-blur-xs font-sans animate-in fade-in duration-75"
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return <div key={idx} className="my-1 border-t border-[#333336]" />;
        }

        const hasSubmenu = item.submenu && item.submenu.length > 0;

        return (
          <div
            key={item.id || idx}
            className="relative"
            onMouseEnter={() => hasSubmenu && setActiveSubmenu(item.id)}
            onMouseLeave={() => hasSubmenu && setActiveSubmenu(null)}
          >
            <button
              onClick={() => {
                if (!item.disabled && item.action) {
                  item.action();
                  onClose();
                }
              }}
              disabled={item.disabled}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer ${
                item.disabled ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {item.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </div>
              {hasSubmenu && <span className="text-[10px] text-gray-400 pl-2">▶</span>}
            </button>

            {/* Submenu */}
            {hasSubmenu && activeSubmenu === item.id && (
              <div
                className="absolute left-full top-0 -ml-1 min-w-[180px] bg-[#1e1e20] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs"
              >
                {item.submenu!.map((sub, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => {
                      if (sub.action) {
                        sub.action();
                        onClose();
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#007acc] hover:text-white transition-colors cursor-pointer"
                  >
                    {sub.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{sub.icon}</span>}
                    <span>{sub.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
