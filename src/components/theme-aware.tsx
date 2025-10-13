import { type ReactNode } from 'react';
import { useThemeUtils } from '@/hooks/use-theme-utils';

interface ThemeAwareProps {
  children: ReactNode;
  light?: ReactNode;
  dark?: ReactNode;
  system?: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that renders different content based on the current theme
 * @param children - Default content to render
 * @param light - Content to render when theme is light
 * @param dark - Content to render when theme is dark
 * @param system - Content to render when theme is system
 * @param fallback - Content to render when no specific theme content is provided
 */
export function ThemeAware({ 
  children, 
  light, 
  dark, 
  system, 
  fallback 
}: ThemeAwareProps) {
  const { theme, resolvedTheme } = useThemeUtils();

  // If specific theme content is provided, use it
  if (theme === 'light' && light !== undefined) {
    return <>{light}</>;
  }
  
  if (theme === 'dark' && dark !== undefined) {
    return <>{dark}</>;
  }
  
  if (theme === 'system' && system !== undefined) {
    return <>{system}</>;
  }

  // If resolved theme content is provided, use it
  if (resolvedTheme === 'light' && light !== undefined) {
    return <>{light}</>;
  }
  
  if (resolvedTheme === 'dark' && dark !== undefined) {
    return <>{dark}</>;
  }

  // Use fallback or default children
  return <>{fallback ?? children}</>;
}
