import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { EndpointDetail } from './pages/EndpointDetail';
import { EndpointList } from './pages/EndpointList';
import { HomePage } from './pages/HomePage';
import { InstanceOverview } from './pages/InstanceOverview';
import { PermissionDetail } from './pages/PermissionDetail';
import { PermissionList } from './pages/PermissionList';
import { ResourceDetail } from './pages/ResourceDetail';
import { ResourceList } from './pages/ResourceList';

const GraphPage = lazy(async () => {
  const mod = await import('./pages/GraphPage');
  return { default: mod.GraphPage };
});

function GraphRoute() {
  return (
    <Suspense fallback={<p className="empty">Loading graph…</p>}>
      <GraphPage />
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/:instance" element={<AppLayout />}>
        <Route index element={<InstanceOverview />} />
        <Route path="permissions" element={<PermissionList />} />
        <Route path="permissions/:permissionId" element={<PermissionDetail />} />
        <Route path="endpoints" element={<EndpointList />} />
        <Route path="endpoints/*" element={<EndpointDetail />} />
        <Route path="resources" element={<ResourceList />} />
        <Route path="resources/:resourceId" element={<ResourceDetail />} />
        <Route path="graph" element={<GraphRoute />} />
        <Route path="graph/:permissionId" element={<GraphRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
