import React from 'react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle(){
  const { mode, setMode } = useTheme();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="opacity-70">Theme</span>
      <select value={mode} onChange={e=>setMode(e.target.value as any)} className="bg-bg-soft text-fg px-2 py-1 rounded">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
