import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { StoreProvider, useStores } from './app/store-context';
import { useOrderPoll } from './app/use-order-poll';
import { I18nProvider, useT } from './i18n';
import { TabBar, Spinner } from './ui';
import type { TabDef, IconName } from './ui';
import { Connect } from './screens/Connect';
import { Dashboard } from './screens/Dashboard';
import { Orders } from './screens/Orders';
import { OrderDetail } from './screens/OrderDetail';
import { Stores } from './screens/Stores';

const TAB_DEFS: { key: string; icon: IconName; labelKey: string }[] = [
	{ key: 'dashboard', icon: 'dashboard', labelKey: 'tabs.dashboard' },
	{ key: 'orders', icon: 'orders', labelKey: 'tabs.orders' },
	{ key: 'stores', icon: 'store', labelKey: 'tabs.stores' },
];

function BottomTabs() {
	const nav = useNavigate();
	const loc = useLocation();
	const t = useT();
	const active = loc.pathname.startsWith('/orders')
		? 'orders'
		: loc.pathname.startsWith('/stores')
			? 'stores'
			: 'dashboard';
	const tabs: TabDef[] = TAB_DEFS.map((d) => ({ key: d.key, icon: d.icon, label: t(d.labelKey) }));
	return <TabBar tabs={tabs} active={active} onSelect={(k) => nav(`/${k}`)} />;
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
						<Route path="/stores" element={<Stores />} />
						<Route path="/connect" element={<Connect />} />
						<Route path="*" element={<Navigate to="/dashboard" replace />} />
					</>
				)}
			</Routes>
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
