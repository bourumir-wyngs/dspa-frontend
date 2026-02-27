import React , { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Link } from 'react-router-dom';


import Home from './components/Home';
import ProteinSearch from './components/Search';
import ProteinVisualization from './components/ProteinView';
import ExperimentInfo from './components/ExperimentView';
import ExperimentsOverview from './components/ExperimentsOverview';
import Impressum from './components/Impressum';
import Condition from './components/conditionView';
import LoginForm from './components/LoginForm';

// Styles Import
import "./styles/main.css";
import "./styles/navigationbar.css";
import "./styles/home.css";
import "./styles/search.css";
import "./styles/graphs.css";
import "./styles/condition.css";
import "./styles/proteinview.css";
import "./styles/experimentView.css";
import "./styles/experimentOverview.css";
import "./styles/nightingale.css";
import "./styles/impressum.css";


const root = createRoot(document.getElementById("root"));

const NotFound = () => <div>Page not found.</div>;

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });

  const handleLogin = (username, password) => {
    if (username === "lipatlas" && password === "lipatlas") {
      localStorage.setItem('isAuthenticated', 'true');
      setIsAuthenticated(true);
    } else {
      localStorage.setItem('isAuthenticated', 'false');
      setIsAuthenticated(false);
      alert('Authentication failed, please check your username and password');
    }
  };

  if (!isAuthenticated) {
    return <div >
      <LoginForm onLogin={handleLogin} />
    </div>;
  }

  return (
    <div>
      <header className="app-header">
          <div className="navbar-top">
          <div className="navigation-bar navigation-white navigation-card">
            <Link to="/" className="navigation-bar-item navigation-button navigation-wide">DYNAPROT</Link>
            <div className="navigation-right navigation-hide-small">
            <Link to="/" className="navigation-bar-item navigation-button">HOME</Link>
            <Link to="/search" className="navigation-bar-item navigation-button">FIND PROTEINS</Link>
            <Link to="/experiments" className="navigation-bar-item navigation-button">EXPERIMENTS</Link>
            <Link to="/impressum" className="navigation-bar-item navigation-button">IMPRESSUM</Link>
            </div>
          </div>  
        </div>    
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<ProteinSearch />} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/visualize/:proteinName" element={<ProteinVisualization />} />
        <Route path="/experiment/:experimentID" element={<ExperimentInfo />} />
        <Route path="/experiments" element={<ExperimentsOverview />} />
        <Route path="/condition/:selectedCondition" element={<Condition />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};


root.render(
  <Router>
    <App /> 
  </Router>
);