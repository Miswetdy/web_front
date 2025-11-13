import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { YearPerson } from '../year_types/YearTypes';
import { getPersons } from '../year_api/YearApi';
import '../styles/historyPersonDetalied.css';

// Простая заглушка страницы детальной информации — в будущем можно подключить react-router и загрузку по id
export default function YearPersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState<YearPerson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) { if (mounted) setLoading(false); return; }
      // try fetching specific person
      try {
        const resp = await fetch(`/api/persons/${id}/`);
        if (resp.ok) {
          const data = await resp.json();
          if (mounted) {
            setPerson({ ...data, image: (data.image ? (data.image.startsWith('http') ? data.image : window.location.origin + data.image) : null) });
            setLoading(false);
          }
          return;
        }
      } catch (_) {}

      // fallback: fetch all and find
      try {
        const all = await getPersons();
        const found = all.find(p => String(p.id) === String(id));
        if (mounted) setPerson(found || null);
      } catch (_) {
        if (mounted) setPerson(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false };
  }, [id]);

  if (loading) return <div className="person-detail"><p>Загрузка...</p></div>;
  if (!person) return <div className="person-detail"><p>Персона не найдена.</p></div>;

  const img = person.image || '/video-poster.png';

  return (
    <div className="person-detail">
    <h2><strong>{person.person_name}</strong></h2>
      <div className="detail-content">
        <div className="detail-image">
          <img src={img} alt={person.person_name} onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = '/video-poster.png'; }} />
        </div>

        <div className="detail-years">
            <h3>Годы правления</h3>
          <p><strong>{person.year_from} — {person.year_to}</strong></p>
        </div>
      </div>
      <div className="detail-desc">
            <h5><strong>Историческая сводка:</strong></h5>
            <p>{ person.description }</p>
        </div>
    </div>
  );
}
