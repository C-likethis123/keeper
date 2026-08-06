import type React from "react";
import { createContext, useContext } from "react";

const StartupReadyContext = createContext<() => void>(() => {});

export function StartupReadyProvider({
	children,
	onReady,
}: {
	children: React.ReactNode;
	onReady: () => void;
}) {
	return (
		<StartupReadyContext.Provider value={onReady}>
			{children}
		</StartupReadyContext.Provider>
	);
}

export function useStartupReady() {
	return useContext(StartupReadyContext);
}
