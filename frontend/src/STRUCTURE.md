# Frontend File Structure

## 📁 Directory Organization

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Specific UI components
│   │   ├── NavBar.jsx   # Navigation component
│   │   └── Charts.jsx   # Chart components
│   └── index.js         # Component exports
├── pages/               # Page components (routes)
│   ├── SwapPage.jsx
│   ├── LiquidityPage.jsx
│   ├── AdvancedTradePage.jsx
│   ├── AnalyticsPage.jsx
│   ├── MockTokenPage.jsx
│   ├── DeploymentPage.jsx
│   └── index.js         # Page exports
├── api/                 # API functions and configurations
├── assets/              # Static assets
├── App.jsx              # Main app component
└── main.jsx            # App entry point
```

## 🎯 Structure Benefits

### **components/ui/**
- Contains reusable UI components
- Pure components with no business logic
- Can be imported by any page

### **pages/**
- Contains page-level components
- Each corresponds to a route
- Contains business logic and page structure

### **Centralized Exports**
- `components/index.js` - Exports all UI components
- `pages/index.js` - Exports all page components
- Cleaner imports in App.jsx and other files

## 📝 Import Examples

### Using centralized exports:
```javascript
// Import multiple pages
import { SwapPage, LiquidityPage } from './pages';

// Import UI components
import { NavBar, PriceChart } from './components';
```

### Direct imports (when needed):
```javascript
import SwapPage from './pages/SwapPage';
import { NavBar } from './components/ui/NavBar';
```