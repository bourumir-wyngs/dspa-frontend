import React , { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Link } from 'react-router-dom';


import Home from './components/Home';
import ProteinSearch from './components/Search';
import ProteinVisualization from './components/ProteinView';
import ExperimentInfo from './components/ExperimentView';
import ExperimentsOverview from './components/ExperimentsOverview';
import Impressum from './components/Impressum';
import Condition from './components/ConditionView';
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
  const [isEthzLogoAvailable, setIsEthzLogoAvailable] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const ethzLogo = new Image();

    ethzLogo.onload = () => {
      if (isMounted) {
        setIsEthzLogoAvailable(true);
      }
    };
    ethzLogo.onerror = () => {
      if (isMounted) {
        setIsEthzLogoAvailable(false);
      }
    };
    ethzLogo.src = "/images/ethz_logo.svg";

    return () => {
      isMounted = false;
    };
  }, []);

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
            <div className="navigation-bar-item navigation-wide navigation-brand">
              {isEthzLogoAvailable ? (
                <a
                  href="https://ethz.ch/en.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="navigation-brand-logo-link"
                >
                  <img
                    src="/images/ethz_logo.svg"
                    onError={() => {
                      setIsEthzLogoAvailable(false);
                    }}
                    alt="ETH Zurich logo"
                    className="navigation-brand-logo"
                  />
                </a>
              ) : (
                <Link to="/" className="navigation-brand-logo-link">
                  <img
                    src="/images/dpa_logo.svg"
                    alt="DynaProt logo"
                    className="navigation-brand-logo"
                  />
                </Link>
              )}
              <Link to="/" className="navigation-brand-text">DYNAPROT</Link>
            </div>
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
        <Route path="/impressum" element={<Impressum showLabInfo={isEthzLogoAvailable} />} />
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
