import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Navbar, Nav, Card, Spinner } from 'react-bootstrap';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Breadcrumbs from './components/Breadcrumbs';
import YearStartPage from './year_pages/YearStartPage'; // ✅ импорт новой главной страницы

const DEFAULT_IMAGE = '/default-person.png';

function PersonsCard({ person }) {
  return (
    <Card style={{ width: '18rem', margin: '0.5rem' }}>
      <Card.Img
        variant="top"
        src={person.image || DEFAULT_IMAGE}
        alt={person.person_name}
      />
      <Card.Body>
        <Card.Title>{person.person_name}</Card.Title>
        <Card.Text>{person.description}</Card.Text>
        <Card.Text>
          <small className="text-muted">
            {person.year_from} — {person.year_to}
          </small>
        </Card.Text>
      </Card.Body>
    </Card>
  );
}

function PersonsPage() {
  const [persons, setPersons] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const resp = await fetch('/api/persons/', { signal: controller.signal });
        if (!resp.ok) throw new Error('Network response was not ok');
        const data = await resp.json();
        setPersons(data);
      } catch (err) {
        try {
          const resp2 = await fetch('/api/persons/?mock=1', { signal: controller.signal });
          if (resp2.ok) {
            const data2 = await resp2.json();
            setPersons(data2);
          } else {
            throw new Error('mock backend not available');
          }
        } catch (err2) {
          setPersons([
            { id: 1, person_name: 'Иванов Иван', year_from: 1850, year_to: 1900, description: 'Описание Ивана', image: '' },
            { id: 2, person_name: 'Петров Пётр', year_from: 1870, year_to: 1920, description: 'Описание Петра', image: '' },
          ]);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  return (
    <Container style={{ marginTop: '1rem' }}>
      <Breadcrumbs items={[{ title: 'Главная', href: '/main' }]} />

      <h1>Персоны</h1>

      {loading && <Spinner animation="border" />}
      {!loading && persons && (
        <Row>
          {persons.map((p) => (
            <Col key={p.id} xs={12} sm={6} md={4} lg={3}>
              <PersonsCard person={p} />
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
}

function App() {
  return (
    <Router>

      <Routes>
        {/* Главная страница */}
        <Route path="/" element={<YearStartPage />} />

        {/* Страница персон */}
        <Route path="/persons" element={<PersonsPage />} />

        {/* 404 */}
        <Route path="*" element={<h2 style={{ textAlign: 'center', marginTop: '2rem' }}>Страница не найдена</h2>} />
      </Routes>
    </Router>
  );
}

export default App;
