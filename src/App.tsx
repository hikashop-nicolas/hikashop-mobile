import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { StoreProvider, useStores } from './app/store-context';
import { VersionsProvider } from './app/versions';
import { HikaDictProvider } from './app/hika-dict';
import { StatusesProvider } from './app/statuses';
import { ThemeProvider } from './app/theme';
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
import { Customers } from './screens/Customers';
import { CustomerDetail } from './screens/CustomerDetail';
import { Discounts } from './screens/Discounts';
import { DiscountEdit } from './screens/DiscountEdit';
import { Stores } from './screens/Stores';
import { Notifications } from './screens/Notifications';
import { SplitView } from './ui/split';
import { UnsavedProvider } from './app/unsaved';
import { DataChangedProvider } from './app/data-changed';
import { UnsavedPrompt } from './ui/unsaved-prompt';

const TAB_DEFS: { key: string; icon: IconName; labelKey: string }[] = [
	{ key: 'dashboard', icon: 'dashboard', labelKey: 'tabs.dashboard' },
	{ key: 'orders', icon: 'orders', labelKey: 'tabs.orders' },
	{ key: 'products', icon: 'products', labelKey: 'tabs.products' },
	{ key: 'categories', icon: 'categories', labelKey: 'tabs.categories' },
	{ key: 'customers', icon: 'customers', labelKey: 'tabs.customers' },
	{ key: 'discounts', icon: 'discount', labelKey: 'tabs.discounts' },
	{ key: 'stores', icon: 'store', labelKey: 'tabs.stores' },
];

function activeKey(pathname: string): string {
	if (pathname.startsWith('/orders')) return 'orders';
	if (pathname.startsWith('/products')) return 'products';
	if (pathname.startsWith('/categories')) return 'categories';
	if (pathname.startsWith('/customers')) return 'customers';
	if (pathname.startsWith('/discounts')) return 'discounts';
	if (pathname.startsWith('/stores') || pathname.startsWith('/notifications')) return 'stores';
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
	const { active: store, stores } = useStores();
	const tab = activeKey(loc.pathname);
	return (
		<nav className="hk-sidenav">
			{/* The active store, tappable to switch: everything you view and create targets it.
			    The chevron only appears when there is more than one store to switch between. */}
			<button className="hk-store-switch" onClick={() => nav('/stores')} title={t('stores.title')}>
				<Icon name="store" size={20} />
				<span className="hk-store-switch-text">
					<span className="hk-store-switch-eyebrow">HikaShop</span>
					<span className="hk-store-switch-name">{store?.name || '…'}</span>
				</span>
				{stores.length > 1 && <Icon name="chevron" size={16} className="hk-store-switch-chevron" />}
			</button>
			{TAB_DEFS.map((d) => (
				<button key={d.key} className={`hk-navitem${tab === d.key ? ' hk-on' : ''}`} onClick={() => nav(`/${d.key}`)}>
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
			if (alive && cached?.data) setCurrencies(cached.data.currencies ?? []);
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

// Runs the foreground poller (new orders + low stock) whenever a store is active and
// notifications are enabled.
function OrderPoller() {
	const { client, active, notifyEnabled, notifySettings } = useStores();
	const t = useT();
	useOrderPoll(client, active, notifyEnabled, t, notifySettings);
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
			<UnsavedPrompt />
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
								{/* Each section is one route with its detail nested, so the list can stay on
								    screen beside the detail where there is room. The URLs are unchanged. */}
								<Route path="/orders" element={<SplitView list={<Orders />} />}>
									<Route path=":id" element={<OrderDetail />} />
									<Route path=":id/fees" element={<OrderFeesEdit />} />
								</Route>
								<Route path="/products" element={<SplitView list={<Products />} />}>
									{/* Single product screen: the list links straight here (no read-only step). */}
									<Route path=":id" element={<ProductEdit />} />
									<Route path=":id/edit" element={<Navigate to=".." relative="path" replace />} />
									<Route path=":id/prices" element={<ProductPricesEdit />} />
									<Route path=":id/variants" element={<ProductVariantsEdit />} />
									<Route path=":id/variants/:vid" element={<VariantEdit />} />
								</Route>
								<Route path="/categories" element={<SplitView list={<Categories />} />}>
									<Route path="new" element={<CategoryEdit />} />
									<Route path=":id/edit" element={<CategoryEdit />} />
								</Route>
								<Route path="/customers" element={<SplitView list={<Customers />} />}>
									<Route path=":id" element={<CustomerDetail />} />
								</Route>
								<Route path="/discounts" element={<SplitView list={<Discounts />} />}>
									<Route path="new" element={<DiscountEdit />} />
									<Route path=":id/edit" element={<DiscountEdit />} />
								</Route>
								<Route path="/stores" element={<Stores />} />
								<Route path="/notifications" element={<Notifications />} />
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
	// Outermost: it only touches the document element, and everything below renders in its theme.
	ThemeProvider,
	I18nProvider,
	StoreProvider,
	VersionsProvider,
	HikaDictProvider,
	StatusesProvider,
	UnsavedProvider,
	DataChangedProvider,
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
