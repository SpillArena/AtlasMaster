import { useTheme as useThemeContext } from '../context/ThemeContext'

/** Adapter rundt ThemeContext som gir `isDark` + `toggleTheme`. */
export function useTheme() {
  const { theme, toggleTheme } = useThemeContext()
  return { isDark: theme === 'dark', toggleTheme }
}
