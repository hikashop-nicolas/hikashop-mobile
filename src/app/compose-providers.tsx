import type { ComponentType, ReactNode } from 'react';

type Provider = ComponentType<{ children: ReactNode }>;

// Compose context providers into a single wrapper so the app reads as a flat list instead of a
// nesting staircase. Order is outermost-first: a provider may use the context of any listed
// before it (the chain is preserved via reduceRight).
export function composeProviders(providers: Provider[]): Provider {
	return function ComposedProviders({ children }: { children: ReactNode }) {
		return providers.reduceRight((acc, P) => <P>{acc}</P>, children);
	};
}
