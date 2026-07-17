export interface MenuItem {
  label?: string;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
  action?: () => void;
  separator?: boolean;
}
