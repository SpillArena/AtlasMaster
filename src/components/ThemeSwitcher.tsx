import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={t('theme.toggle')}
      className="flex items-center gap-1.5 overflow-hidden rounded-md border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="inline-flex"
        >
          <Icon name={isDark ? 'sun' : 'moon'} className="h-4 w-4" />
        </motion.span>
      </AnimatePresence>
      {isDark ? t('theme.light') : t('theme.dark')}
    </button>
  );
}
