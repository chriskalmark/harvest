"use client";

import { useEffect, useState } from 'react';

export function useTheme() {
  // Initialize with null to indicate unhydrated state - we will never render with wrong value
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    // Read actual stored value FIRST before checking class - source of truth is localStorage
    const stored = localStorage.getItem('harvest-theme');
    let initialDark: boolean;
    if (stored === 'light') {
      initialDark = false;
    } else {
      // Dark-first: default to dark unless user explicitly chose light
      initialDark = true;
    }
    
    queueMicrotask(() => setIsDark(initialDark));

    // Ensure correct classes are applied on initial load
    if (initialDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      // Dark-first: system preference changes only apply if user clears stored theme
      if (!localStorage.getItem('harvest-theme')) {
        setIsDark(true);
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemChange);

    // Listen for changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'harvest-theme') {
        const newValue = e.newValue;
        
        let shouldBeDark: boolean;
        if (newValue === 'light') {
          shouldBeDark = false;
        } else {
          shouldBeDark = true;
        }
        
        setIsDark(shouldBeDark);
        if (shouldBeDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleTheme = () => {
    // Safety: if called before hydration, default to toggling from system state
    const current = isDark ?? true;
    const newDark = !current;
    
    setIsDark(newDark);
    
    if (newDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('harvest-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('harvest-theme', 'light');
    }
  };

  return {
    isDark,
    toggleTheme
  };
}