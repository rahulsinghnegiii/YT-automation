import React, { useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  CloudUpload,
  Settings,
  Assessment,
  Schedule,
  Storage,
  BugReport,
  ExitToApp,
  AudioFile,
  SmartToy,
  Notifications,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

// Import page components
import Overview from './pages/Overview';
import Assets from './pages/Assets';
import Upload from './pages/Upload';
import Processing from './pages/Processing';
import Analytics from './pages/Analytics';
import Scheduler from './pages/Scheduler';
import SystemLogs from './pages/SystemLogs';
import Configuration from './pages/Configuration';

const drawerWidth = 240;

const menuItems = [
  { text: 'Overview', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Assets', icon: <AudioFile />, path: '/assets' },
  { text: 'Upload', icon: <CloudUpload />, path: '/upload' },
  { text: 'Processing', icon: <SmartToy />, path: '/processing' },
  { text: 'Analytics', icon: <Assessment />, path: '/analytics' },
  { text: 'Scheduler', icon: <Schedule />, path: '/scheduler' },
  { text: 'System Logs', icon: <BugReport />, path: '/logs' },
  { text: 'Configuration', icon: <Settings />, path: '/config' },
];

const Dashboard = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout } = useAuth();
  const { connected, metrics } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Audio Admin
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography variant="body2" color="text.secondary">
            Status:
          </Typography>
          <Chip
            label={connected ? 'Connected' : 'Disconnected'}
            color={connected ? 'success' : 'error'}
            size="small"
          />
        </Box>
        {metrics && (
          <Box>
            <Typography variant="body2" color="text.secondary">
              CPU: {metrics.cpu?.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Memory: {metrics.memory?.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active Jobs: {metrics.activeJobs || 0}
            </Typography>
          </Box>
        )}
      </Box>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Notifications />
            <IconButton onClick={handleMenuClick}>
              <Avatar sx={{ width: 32, height: 32 }}>
                {user?.email?.[0]?.toUpperCase()}
              </Avatar>
            </IconButton>
          </Box>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              <Typography>{user?.email}</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ExitToApp sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Routes>
          <Route path="/dashboard" element={<Overview />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/scheduler" element={<Scheduler />} />
          <Route path="/logs" element={<SystemLogs />} />
          <Route path="/config" element={<Configuration />} />
          <Route path="/" element={<Overview />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default Dashboard;
