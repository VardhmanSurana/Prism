import { ViewMode } from '@/types';

export interface NavItemData {
  view: ViewMode;
  icon: React.ElementType;
  label: string;
}

export interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}
