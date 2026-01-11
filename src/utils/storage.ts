// LocalStorage key format: pivot_levels_YYYY-MM-DD_INDEX
const getPivotStorageKey = (date: Date, index: string) => {
  const dateStr = date.toISOString().split('T')[0]; // 2026-01-11
  return `pivot_levels_${dateStr}_${index}`;
};

export const savePivotLevels = (index: string, levels: any) => {
  const today = new Date();
  const key = getPivotStorageKey(today, index);
  localStorage.setItem(key, JSON.stringify(levels));
};

export const loadPivotLevels = (index: string) => {
  const today = new Date();
  const key = getPivotStorageKey(today, index);
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

export const clearOldPivotLevels = () => {
  const today = new Date().toISOString().split('T')[0];

  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('pivot_levels_') && !key.includes(today)) {
      localStorage.removeItem(key);
      console.log(`🗑️ Cleared old pivot levels: ${key}`);
    }
  });
};

export const clearTodayPivotLevels = () => {
  const today = new Date().toISOString().split('T')[0];

  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('pivot_levels_') && key.includes(today)) {
      localStorage.removeItem(key);
      console.log(`🗑️ Market closed – Cleared: ${key}`);
    }
  });
};
