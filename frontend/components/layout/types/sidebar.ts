import { ViewMode } from '@/types';

export interface NavItemData {
  view: ViewMode;
  icon: React.ElementType;
  label: string;
}

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}
