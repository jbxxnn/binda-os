"use client";

import { createContext, useContext } from "react";

type AppSessionContextValue = {
  businessId: string | null;
  businessName: string;
  userName: string;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

type AppSessionProviderProps = AppSessionContextValue & {
  children: React.ReactNode;
};

export function AppSessionProvider({
  businessId,
  businessName,
  userName,
  children,
}: AppSessionProviderProps) {
  return (
    <AppSessionContext.Provider
      value={{
        businessId,
        businessName,
        userName,
      }}
    >
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const context = useContext(AppSessionContext);

  if (!context) {
    throw new Error("useAppSession must be used within AppSessionProvider.");
  }

  return context;
}
