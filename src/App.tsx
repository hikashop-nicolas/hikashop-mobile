import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { StoreProvider, useStores } from './app/store-context';
import { VersionsProvider } from './app/versions';
import { HikaDictProvider } from './app/hika-dict';
import { StatusesProvider } from './app/statuses';
import { ThemeProvider } from './app/theme';
import { composeProviders } from './app/compose-providers';
import { ShortcutProvider } from './app/use-shortcuts';
import { ShortcutHelp } from './screens/ShortcutHelp';
import { useOrderPoll } from './app/use-order-poll';
import { I18nProvider, useT } from './i18n';
import { TabBar, Spinner, Icon, CurrencyProvider, StoreLogo } from './ui';
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

// `acl` is the kind of record in the vocabulary of HikaShop's access levels; a tab whose kind the
// operator may not view is not offered. Stores has none: it is where you go to switch or leave a
// shop, which no shop setting should be able to take away.
const TAB_DEFS: { key: string; icon: IconName; labelKey: string; acl?: string }[] = [
	{ key: 'dashboard', icon: 'dashboard', labelKey: 'tabs.dashboard', acl: 'dashboard' },
	{ key: 'orders', icon: 'orders', labelKey: 'tabs.orders', acl: 'order' },
	{ key: 'products', icon: 'products', labelKey: 'tabs.products', acl: 'product' },
	{ key: 'categories', icon: 'categories', labelKey: 'tabs.categories', acl: 'category' },
	{ key: 'customers', icon: 'customers', labelKey: 'tabs.customers', acl: 'user' },
	{ key: 'discounts', icon: 'discount', labelKey: 'tabs.discounts', acl: 'discount' },
	{ key: 'stores', icon: 'store', labelKey: 'tabs.stores' },
];

// The shop enforces this; the app only avoids offering what it would be refused. An older
// connector reports nothing, which is read as allowed.
function useVisibleTabs(): typeof TAB_DEFS {
	const { active } = useStores();
	const perms = active?.permissions;
	if (!perms) return TAB_DEFS;
	return TAB_DEFS.filter((d) => !d.acl || perms[d.acl]?.view !== false);
}

// How long a section takes to change places. Shorter than opening a record, which is a bigger
// move: a tab change happens constantly and should not feel like waiting.
const SECTION_MS = 300;

function orderOf(section: string): number {
	const at = TAB_DEFS.findIndex((d) => d.key === section);
	return at < 0 ? 0 : at;
}

// Moving between sections is a change of place, so it looks like one: the section you leave slides
// away and the one you arrive at comes from the other side, up or down depending on which way you
// moved through the menu.
//
// Both are on screen at once, which is what makes it read as movement rather than a redraw. The
// one leaving keeps its key, so React keeps its subtree: it slides away still holding the data it
// had, rather than a second copy mounting and fetching everything again on the way out.
function SectionTransition({ children }: { children: ReactNode }) {
	const loc = useLocation();
	const section = activeKey(loc.pathname);
	const [current, setCurrent] = useState({ section, loc });
	const [leaving, setLeaving] = useState<{ section: string; loc: typeof loc } | null>(null);
	const [dir, setDir] = useState(1);

	useEffect(() => {
		// Staying in the same section (opening a record, changing a filter) is not a move.
		if (section === current.section) {
			if (loc !== current.loc) setCurrent({ section, loc });
			return;
		}
		setDir(orderOf(section) > orderOf(current.section) ? 1 : -1);
		setLeaving(current);
		setCurrent({ section, loc });
		const t = setTimeout(() => setLeaving(null), SECTION_MS);
		return () => clearTimeout(t);
		// Driven by the location alone; `current` is what it is compared against, and including
		// it would re-run this on the very change it makes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loc]);

	const style = { '--hk-dir': dir } as CSSProperties;
	return (
		<div className="hk-viewstack" style={style}>
			{leaving && (
				<div key={leaving.section} className="hk-view hk-view--leave" aria-hidden="true">
					<Routes location={leaving.loc}>{children}</Routes>
				</div>
			)}
			<div key={current.section} className={`hk-view${leaving ? ' hk-view--enter' : ''}`}>
				<Routes location={current.loc}>{children}</Routes>
			</div>
		</div>
	);
}

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
	const tabs: TabDef[] = useVisibleTabs().map((d) => ({ key: d.key, icon: d.icon, label: t(d.labelKey) }));
	return <TabBar tabs={tabs} active={activeKey(loc.pathname)} onSelect={(k) => nav(`/${k}`)} />;
}

// Left sidebar navigation (tablet/desktop widths).
function SideNav() {
	const nav = useNavigate();
	const loc = useLocation();
	const t = useT();
	const { active: store, stores } = useStores();
	const visible = useVisibleTabs();
	const tab = activeKey(loc.pathname);
	return (
		<nav className="hk-sidenav">
			{/* The active store, tappable to switch: everything you view and create targets it.
			    The chevron only appears when there is more than one store to switch between. */}
			<button className="hk-store-switch" onClick={() => nav('/stores')} title={t('stores.title')}>
				{/* The shop's own logo where it has one, otherwise the generic store mark. */}
				<StoreLogo src={store?.logo} className="hk-store-switch-logo" fallback={<Icon name="store" size={20} />} />
				<span className="hk-store-switch-text">
					<span className="hk-store-switch-eyebrow">HikaShop</span>
					<span className="hk-store-switch-name">{store?.name || '…'}</span>
				</span>
				{stores.length > 1 && <Icon name="chevron" size={16} className="hk-store-switch-chevron" />}
			</button>
			{visible.map((d) => (
				<button key={d.key} className={`hk-navitem${tab === d.key ? ' hk-on' : ''}`} onClick={() => nav(`/${d.key}`)}>
					<Icon name={d.icon} size={20} /><span>{t(d.labelKey)}</span>
				</button>
			))}
		</nav>
	);
}

// Loads the active store's currencies and its rounding mode (from cache, then network) and
// provides them so the Money atom can format prices to each currency's settings.
function CurrencyGate({ children }: { children: React.ReactNode }) {
	const { client, active, cache } = useStores();
	const [currencies, setCurrencies] = useState<Currency[]>([]);
	const [roundCalculations, setRoundCalculations] = useState(0);
	useEffect(() => {
		if (!client || !active) { setCurrencies([]); setRoundCalculations(0); return; }
		let alive = true;
		void (async () => {
			const cached = await cache.getProductMeta(active.id);
			if (alive && cached?.data) setCurrencies(cached.data.currencies ?? []);
			const cachedSettings = await cache.getSettings(active.id);
			if (alive && cachedSettings?.data) setRoundCalculations(cachedSettings.data.round_calculations ?? 0);
			try {
				const m = await client.getProductMeta();
				if (!alive) return;
				setCurrencies(m.currencies ?? []);
				await cache.putProductMeta(active.id, m);
			} catch { /* keep cached currencies */ }
			try {
				const s = await client.getSettings();
				if (!alive) return;
				setRoundCalculations(s.round_calculations ?? 0);
				await cache.putSettings(active.id, s);
			} catch { /* keep the cached mode */ }
		})();
		return () => { alive = false; };
	}, [client, active, cache]);
	return (
		<CurrencyProvider currencies={currencies} roundCalculations={roundCalculations}>
			{children}
		</CurrencyProvider>
	);
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
					<SectionTransition>
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
					</SectionTransition>
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
				{/* Inside the router: the shortcuts navigate, so they need its context. */}
				<ShortcutProvider>
					<Shell />
					<ShortcutHelp />
				</ShortcutProvider>
			</HashRouter>
		</AppProviders>
	);
}
