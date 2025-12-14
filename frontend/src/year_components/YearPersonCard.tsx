import React, { useState } from 'react';
import type { YearPerson } from '../year_types/YearTypes';
import { addToOrder } from '../year_api/YearApi';
import '../styles/historyPerson.css'

export default function YearPersonCard({ person }: { person: YearPerson }) {
  const staticById = `/images/historyPerson${person.id}.png`;
  const fallback = '/img.png';
  const src = person.image || staticById || fallback;

  const [isAdding, setIsAdding] = useState(false);

  // ✅ Проверяем авторизацию (есть ли токен)
  const isAuthenticated = Boolean(
    localStorage.getItem('token') || sessionStorage.getItem('token')
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isAdding) return;
    setIsAdding(true);
    try {
      const resp = await addToOrder(person.id);
      if (resp && resp.ok) {
        try { window.dispatchEvent(new CustomEvent('order-updated', { detail: { personId: person.id } })); } catch(_){ }
        setIsAdding(false);
        return;
      }
      console.warn('addToOrder response:', resp);
      alert('Не удалось добавить в заявку');
    } catch (err) {
      console.error(err);
      alert('Ошибка при добавлении в заявку');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="person-card">
      <div className="card-header">
        <div className="person-name">{person.person_name}</div>

        {/* Показываем кнопку только если пользователь авторизован */}
        {isAuthenticated && (
          <form method="post" onSubmit={handleSubmit}>
            <button type="submit" className="expand-btn" disabled={isAdding}>
              {isAdding ? '+' : '+'}
            </button>
          </form>
        )}
      </div>

      <hr />

      <div className="card-image">
        <img
          src={src}
          alt={person.person_name}
          onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = '/video-poster.png'; }}
        />
      </div>

      <div className="card-years">
        <p>Годы правления</p>
        <p style={{ marginLeft: '0px' }}>
          <strong>{person.year_from} — {person.year_to}</strong>
        </p>
      </div>

      <a href={`/person/${person.id}`} className="details-btn">Подробнее →</a>
    </div>
  );
}
