import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { StoreProvider, useStores } from './app/store-context';
import { VersionsProvider } from './app/versions';
import { HikaDictProvider } from './app/hika-dict';
import { StatusesProvider } from './app/statuses';
import { composeProviders } from './app/compose-providers';
import { useOrderPoll } from './app/use-order-poll';
import { I18nProvider, useT } from './i18n';
import { TabBar, Spinner, Icon, CurrencyProvider } from './ui';
import type { TabDef, IconName } from './ui';
import type { Currency } from './core';
import { Connect } from './screens/Connect';
import { Dashboard } from './screens/Dashboard';
import { Orders } from './screens/Orders';
import { OrderDetail } from './screens/OrderDetail';
import { Products } from './screens/Products';
import { ProductEdit } from './screens/ProductEdit';
import { ProductPricesEdit } from './screens/ProductPricesEdit';
import { OrderFeesEdit } from './screens/OrderFeesEdit';
import { ProductVariantsEdit } from './screens/ProductVariantsEdit';
import { VariantEdit } from './screens/VariantEdit';
import { Categories } from './screens/Categories';
import { CategoryEdit } from './screens/CategoryEdit';
import { Stores } from './screens/Stores';

const TAB_DEFS: { key: string; icon: IconName; labelKey: string }[] = [
	{ key: 'dashboard', icon: 'dashboard', labelKey: 'tabs.dashboard' },
	{ key: 'orders', icon: 'orders', labelKey: 'tabs.orders' },
	{ key: 'products', icon: 'products', labelKey: 'tabs.products' },
	{ key: 'categories', icon: 'categories', labelKey: 'tabs.categories' },
	{ key: 'stores', icon: 'store', labelKey: 'tabs.stores' },
];

function activeKey(pathname: string): string {
	if (pathname.startsWith('/orders')) return 'orders';
	if (pathname.startsWith('/products')) return 'products';
	if (pathname.startsWith('/categories')) return 'categories';
	if (pathname.startsWith('/stores')) return 'stores';
	return 'dashboard';
}

// Bottom tab bar (compact/phone widths).
function BottomTabs() {
	const nav = useNavigate();
	const loc = useLocation();
	const t = useT();
	const tabs: TabDef[] = TAB_DEFS.map((d) => ({ key: d.key, icon: d.icon, label: t(d.labelKey) }));
	return <TabBar tabs={tabs} active={activeKey(loc.pathname)} onSelect={(k) => nav(`/${k}`)} />;
}

// Left sidebar navigation (tablet/desktop widths).
function SideNav() {
	const nav = useNavigate();
	const loc = useLocation();
	const t = useT();
	const active = activeKey(loc.pathname);
	return (
		<nav className="hk-sidenav">
			<div className="hk-brand">HikaShop</div>
			{TAB_DEFS.map((d) => (
				<button key={d.key} className={`hk-navitem${active === d.key ? ' hk-on' : ''}`} onClick={() => nav(`/${d.key}`)}>
					<Icon name={d.icon} size={20} /><span>{t(d.labelKey)}</span>
				</button>
			))}
		</nav>
	);
}

// Loads the active store's currencies (from cache, then network) and provides them
// so the Money atom can format prices to each currency's settings.
function CurrencyGate({ children }: { children: React.ReactNode }) {
	const { client, active, cache } = useStores();
	const [currencies, setCurrencies] = useState<Currency[]>([]);
	useEffect(() => {
		if (!client || !active) { setCurrencies([]); return; }
		let alive = true;
		void (async () => {
			const cached = await cache.getProductMeta(active.id);
			if (alive && cached?.value) setCurrencies(cached.value.currencies ?? []);
			try {
				const m = await client.getProductMeta();
				if (!alive) return;
				setCurrencies(m.currencies ?? []);
				await cache.putProductMeta(active.id, m);
			} catch { /* keep cached currencies */ }
		})();
		return () => { alive = false; };
	}, [client, active, cache]);
	return <CurrencyProvider currencies={currencies}>{children}</CurrencyProvider>;
}

// Runs the foreground order poller whenever a store is active and notifications are enabled.
function OrderPoller() {
	const { client, active, notifyEnabled } = useStores();
	const t = useT();
	useOrderPoll(client, active, notifyEnabled, t);
	return null;
}

function Shell() {
	const { ready, active } = useStores();
	if (!ready) {
		return (
			<div className="hk-app">
				<main className="hk-body hk-center"><Spinner /></main>
			</div>
		);
	}
	return (
		<div className="hk-app">
			{active && <SideNav />}
			<div className="hk-main">
				<CurrencyGate>
					<Routes>
						{!active ? (
							<>
								<Route path="/connect" element={<Connect />} />
								<Route path="*" element={<Navigate to="/connect" replace />} />
							</>
						) : (
							<>
								<Route path="/dashboard" element={<Dashboard />} />
								<Route path="/orders" element={<Orders />} />
								<Route path="/orders/:id" element={<OrderDetail />} />
								<Route path="/orders/:id/fees" element={<OrderFeesEdit />} />
								<Route path="/products" element={<Products />} />
								{/* Single product screen: the list links straight here (no read-only step). */}
								<Route path="/products/:id" element={<ProductEdit />} />
								<Route path="/products/:id/edit" element={<Navigate to=".." relative="path" replace />} />
								<Route path="/products/:id/prices" element={<ProductPricesEdit />} />
								<Route path="/products/:id/variants" element={<ProductVariantsEdit />} />
							<Route path="/products/:id/variants/:vid" element={<VariantEdit />} />
								<Route path="/categories" element={<Categories />} />
							<Route path="/categories/new" element={<CategoryEdit />} />
							<Route path="/categories/:id/edit" element={<CategoryEdit />} />
								<Route path="/stores" element={<Stores />} />
								<Route path="/connect" element={<Connect />} />
								<Route path="*" element={<Navigate to="/dashboard" replace />} />
							</>
						)}
					</Routes>
				</CurrencyGate>
			</div>
			{active && <BottomTabs />}
			{active && <OrderPoller />}
		</div>
	);
}

// Outermost first: each provider may use the context of those listed before it.
const AppProviders = composeProviders([
	I18nProvider,
	StoreProvider,
	VersionsProvider,
	HikaDictProvider,
	StatusesProvider,
]);

export default function App() {
	return (
		<AppProviders>
			<HashRouter>
				<Shell />
			</HashRouter>
		</AppProviders>
	);
}
