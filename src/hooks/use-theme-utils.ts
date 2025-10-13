import { useTheme } from '@/contexts/theme-context';

/**
 * Hook that provides theme utilities and current theme state
 * @returns Theme utilities and state
 */
export function useThemeUtils() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const isDark = resolvedTheme === 'dark';
  const isLight = resolvedTheme === 'light';
  const isSystem = theme === 'system';

  return {
    theme,
    setTheme,
    resolvedTheme,
    toggleTheme,
    isDark,
    isLight,
    isSystem,
  };
}
