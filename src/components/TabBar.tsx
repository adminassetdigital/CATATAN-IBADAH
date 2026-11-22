import { BarChart3, CheckSquare, Heart, Settings } from 'lucide-react';
import type { TabId } from '../constants/ibadah';

interface TabBarProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}

const TABS: ReadonlyArray<{
  id: TabId;
  label: string;
  Icon: typeof CheckSquare;
}> = [
  { id: 'hari_ini', label: 'Hari Ini', Icon: CheckSquare },
  { id: 'syukur', label: 'Syukur', Icon: Heart },
  { id: 'statistik', label: 'Statistik', Icon: BarChart3 },
  { id: 'pengaturan', label: 'Pengaturan', Icon: Settings },
];

export function TabBar({ activeTab, onChangeTab }: TabBarProps) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E6E0D4] bg-white/95 backdrop-blur-md"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'text-emerald-800 font-semibold'
                  : 'text-[#626E67] hover:text-[#1C2420]'
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  isActive ? 'text-emerald-700 stroke-[2.25]' : 'stroke-[1.75]'
                }`}
                aria-hidden="true"
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
