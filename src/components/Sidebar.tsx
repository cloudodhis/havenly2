import React from 'react';
import { Map, Pin, Inbox, Settings, Compass } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
}

function SidebarItem({ icon: Icon, label, active }: SidebarItemProps) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-1 py-4 cursor-pointer transition-colors group",
      active ? "text-purple-600" : "text-gray-500 hover:text-gray-600"
    )}>
      <Icon className={cn("w-6 h-6", active && "text-purple-600")} />
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      {active && <div className="absolute left-0 w-1 h-8 bg-purple-600 rounded-r-full" />}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 h-screen sticky top-0 z-50">
      <div className="mb-10">
        <Compass className="w-8 h-8 text-purple-600" />
      </div>
      
      <div className="flex flex-col gap-2 w-full relative">
        <SidebarItem icon={Map} label="Map" active />
        <SidebarItem icon={Pin} label="Saved" />
        <SidebarItem icon={Inbox} label="Inbox" />
        <SidebarItem icon={Settings} label="Settings" />
      </div>
    </aside>
  );
}
