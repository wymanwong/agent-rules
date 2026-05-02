import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const DRAWER_WIDTH = 280;

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeDrawer = () => setMobileOpen(false);

  const navItems: { label: string; to: string; show: boolean }[] = [
    { label: 'Portal', to: '/', show: true },
    { label: 'Knowledge', to: '/knowledge', show: true },
    { label: 'My Requests', to: '/my-requests', show: !!user },
    { label: 'IT Queue', to: '/it/queue', show: !!user && (user.role === 'IT' || user.role === 'Admin') },
    { label: 'Admin', to: '/admin', show: !!user && user.role === 'Admin' },
    { label: 'Catalog admin', to: '/admin/catalog', show: !!user && user.role === 'Admin' },
  ].filter((i) => i.show);

  const drawer = (
    <Box sx={{ width: DRAWER_WIDTH, pt: 2 }} role="presentation">
      <Typography variant="subtitle2" sx={{ px: 2, pb: 1, color: 'text.secondary' }}>
        Navigate
      </Typography>
      <List dense>
        {navItems.map((item) => (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            selected={location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))}
            onClick={closeDrawer}
          >
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider sx={{ my: 1 }} />
      {user ? (
        <>
          <Typography variant="caption" sx={{ px: 2, display: 'block', color: 'text.secondary' }}>
            {user.name} · {user.role}
          </Typography>
          <List dense>
            <ListItemButton
              onClick={() => {
                logout();
                closeDrawer();
                navigate('/login');
              }}
            >
              <ListItemText primary="Log out" />
            </ListItemButton>
          </List>
        </>
      ) : (
        <List dense>
          <ListItemButton component={RouterLink} to="/login" onClick={closeDrawer}>
            <ListItemText primary="Sign in" />
          </ListItemButton>
        </List>
      )}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap', minHeight: { xs: 56, sm: 64 } }}>
          {isNarrow && (
            <IconButton color="inherit" edge="start" aria-label="open menu" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              flexGrow: isNarrow ? 1 : undefined,
              color: 'inherit',
              textDecoration: 'none',
              fontSize: { xs: '1rem', sm: undefined },
            }}
          >
            IT Helpdesk
          </Typography>
          {!isNarrow && (
            <>
              <Button color="inherit" component={RouterLink} to="/">
                Portal
              </Button>
              <Button color="inherit" component={RouterLink} to="/knowledge">
                Knowledge
              </Button>
              {user ? (
                <>
                  <Button color="inherit" component={RouterLink} to="/my-requests">
                    My Requests
                  </Button>
                  {(user.role === 'IT' || user.role === 'Admin') && (
                    <Button color="inherit" component={RouterLink} to="/it/queue">
                      IT Queue
                    </Button>
                  )}
                  {user.role === 'Admin' && (
                    <>
                      <Button color="inherit" component={RouterLink} to="/admin">
                        Admin
                      </Button>
                      <Button color="inherit" component={RouterLink} to="/admin/catalog" sx={{ display: { xs: 'none', lg: 'inline-flex' } }}>
                        Catalog
                      </Button>
                    </>
                  )}
                  <Typography variant="body2" sx={{ opacity: 0.9, display: { xs: 'none', lg: 'block' } }}>
                    {user.name} ({user.role})
                  </Typography>
                  <Button
                    color="inherit"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                  >
                    Log out
                  </Button>
                </>
              ) : (
                <Button color="inherit" component={RouterLink} to="/login">
                  Sign in
                </Button>
              )}
            </>
          )}
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={mobileOpen} onClose={closeDrawer} ModalProps={{ keepMounted: true }}>
        {drawer}
      </Drawer>

      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
