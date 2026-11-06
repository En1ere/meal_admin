import { Outlet, useLocation } from 'react-router-dom';
import { activeSectionForPath } from '../../entities/admin-section/index.js';
import { AdminShell } from './AdminShell.js';

export function AdminWorkspaceShell() {
    const { pathname } = useLocation();
    return (
        <AdminShell active={activeSectionForPath(pathname)}>
            <Outlet />
        </AdminShell>
    );
}
