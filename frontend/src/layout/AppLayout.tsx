import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" component={RouterLink} to="/" sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}>
            IT Helpdesk
          </Typography>
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
                <Button color="inherit" component={RouterLink} to="/admin">
                  Admin
                </Button>
              )}
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
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
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
