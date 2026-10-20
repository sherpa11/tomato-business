import React, { createContext, useContext, useState, useEffect } from 'react';

const DateContext = createContext(null);

export const DateProvider = ({ children }) => {
  // Get current local calendar date in Asia/Kolkata (YYYY-MM-DD)
  const getSystemToday = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const [operationalDate, setOperationalDate] = useState(() => {
    return localStorage.getItem('tomato_operational_date') || getSystemToday();
  });

  useEffect(() => {
    localStorage.setItem('tomato_operational_date', operationalDate);
  }, [operationalDate]);

  const resetToToday = () => {
    setOperationalDate(getSystemToday());
  };

  return (
    <DateContext.Provider
      value={{
        operationalDate,
        setOperationalDate,
        resetToToday,
        isToday: operationalDate === getSystemToday()
      }}
    >
      {children}
    </DateContext.Provider>
  );
};

export const useDate = () => useContext(DateContext);
