import { createContext, useContext } from 'react';

export interface MenuContextValue {
  close: (refocus?: boolean) => void;
}

export const MenuContext = createContext<MenuContextValue | null>(null);

export function useMenu(): MenuContextValue {
  const value = useContext(MenuContext);
  if (!value) throw new Error('Menu items must be rendered inside <Menu>.');
  return value;
}
