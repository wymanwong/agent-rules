import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link ${isActive ? 'active' : ''}`;

  return (
    <div className="page">
      <header className="navbar navbar-expand-md navbar-light d-print-none border-bottom bg-white sticky-top shadow-sm">
        <div className="container-fluid px-3">
          <NavLink className="navbar-brand fw-semibold text-primary" to="/">
            IT Helpdesk
          </NavLink>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbar-menu"
            aria-controls="navbar-menu"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="navbar-menu">
            <ul className="navbar-nav me-auto mb-2 mb-md-0 gap-md-1">
              <li className="nav-item">
                <NavLink className={linkClass} to="/">
                  Portal
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className={linkClass} to="/knowledge">
                  Knowledge
                </NavLink>
              </li>
              {user && (
                <>
                  <li className="nav-item">
                    <NavLink className={linkClass} to="/my-requests">
                      My Requests
                    </NavLink>
                  </li>
                  {(user.role === 'IT' || user.role === 'Admin') && (
                    <li className="nav-item">
                      <NavLink className={linkClass} to="/it/queue">
                        IT Queue
                      </NavLink>
                    </li>
                  )}
                  {user.role === 'Admin' && (
                    <>
                      <li className="nav-item">
                        <NavLink className={linkClass} to="/admin">
                          Admin
                        </NavLink>
                      </li>
                      <li className="nav-item d-none d-lg-block">
                        <NavLink className={linkClass} to="/admin/catalog">
                          Catalog
                        </NavLink>
                      </li>
                    </>
                  )}
                </>
              )}
            </ul>
            <div className="navbar-nav flex-row flex-wrap align-items-center gap-2 ms-md-auto">
              {user ? (
                <>
                  <span className="nav-link disabled py-1 small text-secondary">
                    {user.name} · {user.role}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <NavLink className="btn btn-primary btn-sm" to="/login">
                  Sign in
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="page-wrapper">
        <div className="page-body">
          <div className="container-xl py-4">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
