import { useEffect, useState } from 'react';

type Mode = 'system'|'light'|'dark';
export function useTheme() {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('theme') as Mode) || 'system');
  useEffect(() => {
    const r = document.documentElement;
    if (mode === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', mode);
    localStorage.setItem('theme', mode);
  }, [mode]);
  return { mode, setMode };
}
