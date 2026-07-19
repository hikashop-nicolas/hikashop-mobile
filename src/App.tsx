import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { StoreProvider, useStores } from './app/store-context';
import { useOrderPoll } from './app/use-order-poll';
import { TabBar, Spinner } from './ui';
import type { TabDef } from './ui';
import { Connect } from './screens/Connect';
import { Dashboard } from './screens/Dashboard';
import { Orders } from './screens/Orders';
import { OrderDetail } from './screens/OrderDetail';
import { Stores } from './screens/Stores';

const TABS: TabDef[] = [
	{ key: 'dashboard', label: 'Dashboard', icon: '▦' },
	{ key: 'orders', label: 'Orders', icon: '🧾' },
	{ key: 'stores', label: 'Stores', icon: '🏬' },
];

function BottomTabs() {
	const nav = useNavigate();
	const loc = useLocation();
	const active = loc.pathname.startsWith('/orders')
		? 'orders'
		: loc.pathname.startsWith('/stores')
			? 'stores'
			: 'dashboard';
	return <TabBar tabs={TABS} active={active} onSelect={(k) => nav(`/${k}`)} />;
}

// Runs the foreground order poller whenever a store is active and notifications are enabled.
function OrderPoller() {
	const { client, active, notifyEnabled } = useStores();
	useOrderPoll(client, active, notifyEnabled);
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
		<StoreProvider>
			<HashRouter>
				<Shell />
			</HashRouter>
		</StoreProvider>
	);
}
