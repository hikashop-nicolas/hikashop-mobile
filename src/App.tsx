import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { StoreProvider, useStores } from './app/store-context';
import { useOrderPoll } from './app/use-order-poll';
import { I18nProvider, useT } from './i18n';
import { TabBar, Spinner, Icon } from './ui';
import type { TabDef, IconName } from './ui';
import { Connect } from './screens/Connect';
import { Dashboard } from './screens/Dashboard';
import { Orders } from './screens/Orders';
import { OrderDetail } from './screens/OrderDetail';
import { Products } from './screens/Products';
import { ProductDetail } from './screens/ProductDetail';
import { Stores } from './screens/Stores';

const TAB_DEFS: { key: string; icon: IconName; labelKey: string }[] = [
	{ key: 'dashboard', icon: 'dashboard', labelKey: 'tabs.dashboard' },
	{ key: 'orders', icon: 'orders', labelKey: 'tabs.orders' },
	{ key: 'products', icon: 'products', labelKey: 'tabs.products' },
	{ key: 'stores', icon: 'store', labelKey: 'tabs.stores' },
];

function activeKey(pathname: string): string {
	if (pathname.startsWith('/orders')) return 'orders';
	if (pathname.startsWith('/products')) return 'products';
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
							<Route path="/products" element={<Products />} />
							<Route path="/products/:id" element={<ProductDetail />} />
							<Route path="/stores" element={<Stores />} />
							<Route path="/connect" element={<Connect />} />
							<Route path="*" element={<Navigate to="/dashboard" replace />} />
						</>
					)}
				</Routes>
			</div>
			{active && <BottomTabs />}
			{active && <OrderPoller />}
		</div>
	);
}

export default function App() {
	return (
		<I18nProvider>
			<StoreProvider>
				<HashRouter>
					<Shell />
				</HashRouter>
			</StoreProvider>
		</I18nProvider>
	);
}
