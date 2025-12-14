import React from 'react';
import { Container } from 'react-bootstrap';
import YearHome from './year_pages/YearHome';
import YearBreadcrumbs from './year_components/YearBreadcrumbs';
import YearPersonDetail from './year_pages/YearPersonDetail';
import { Routes, Route, Link } from 'react-router-dom';
import './YearApp.css';
import OrderPage from './year_pages/YearOrder';
import YearStartPage from './year_pages/YearStartPage';

export default function YearDeterminationApp() {
  console.log('YearDeterminationApp render');
  return (
      <body>
      <header>
         <Link to="/persons" className="header-logo">
            <img src="http://localhost:9000/images/logo_chtivo.png" alt="Чтиво"></img>
         </Link>
         <nav className="header-nav">
            <Link to="/" className="nav-link">Главная</Link>
            <Link to="/persons" className="nav-link">Услуги</Link>
         </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<YearStartPage />} />
          <Route path="/persons" element={<YearHome />} />
          <Route path="/person/:id" element={<YearPersonDetail />} />
          <Route path="/order/:id" element={<OrderPage />} />
          {/* old external URL used by templates: support /orderForPredictingYear/:id/ */}
          <Route path="/orderForPredictingYear/:id/*" element={<OrderPage />} />
        </Routes>
      </main>
    </body>
  );
}
