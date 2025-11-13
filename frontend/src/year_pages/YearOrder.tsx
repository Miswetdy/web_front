import React, { useEffect, useState } from 'react';
import { getCurrentOrder, removeOrderItem, saveOrder, makeOrder } from '../year_api/YearApi';
import { useNavigate } from 'react-router-dom';
import '../styles/orderForPredictingYear.css';

// Helper to read Django CSRF token from cookies
function getCsrfTokenFromCookie(): string | null {
  const name = 'csrftoken=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(name) === 0) return decodeURIComponent(c.substring(name.length));
  }
  return null;
}

export default function OrderPage() {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [histText, setHistText] = useState('');
  const [confidences, setConfidences] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    getCurrentOrder().then(data => {
      if (!mounted) return;
      if (!data || data.order === null || !data.order_id) {
        setOrder(null);
        setLoading(false);
        return;
      }
      setOrder(data);
      setHistText(data.history_text || '');
      const conf: Record<string, string> = {};
      (data.items || []).forEach((it: any) => conf[`confidence_${it.person_id}`] = String(it.percent_of_trust ?? 1));
      setConfidences(conf);
      setLoading(false);
    }).catch(() => { setOrder(null); setLoading(false); });
    return () => { mounted = false };
  }, []);

  if (loading) return <div className="cart-container"><p>Загрузка...</p></div>;
  if (!order) return <div className="cart-container"><p>У вас нет текущей заявки.</p></div>;

  const handleRemove = async (itemId: number) => {
    if (!confirm('Удалить элемент?')) return;
    await removeOrderItem(itemId);
    const updated = await getCurrentOrder();
    setOrder(updated);
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const payload: any = { history_text: histText };
    for (const k in confidences) payload[k] = confidences[k];
    try {
      await saveOrder(order.order_id, payload);
      alert('Сохранено');
      const updated = await getCurrentOrder();
      setOrder(updated);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении');
    }
  }

  const handleMake = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const confPayload: any = {};
    for (const k in confidences) confPayload[k] = confidences[k];
    try {
      const res = await makeOrder(order.order_id, confPayload);
      // makeOrder returns JSON; if expected is ok flag, handle accordingly
      if (res && (res.ok || res.year_from_result !== undefined)) {
        alert(`Результат: ${res.year_from_result || '—'} — ${res.year_to_result || '—'}`);
        const updated = await getCurrentOrder();
        setOrder(updated);
      } else {
        alert('Ошибка при расчёте');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при расчёте');
    }
  }

  const handleDeleteOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!confirm('Удалить заявку?')) return;
    try {
      const csrf = getCsrfTokenFromCookie();
      await fetch(`/orderForPredictingYear/delete/${order.order_id}/`, {
        method: 'POST',
        headers: csrf ? { 'X-CSRFToken': csrf } : {},
        credentials: 'same-origin',
      });
      // after deletion redirect to main page
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении заявки');
    }
  }

  return (
    <div className="cart-container">
      <h2 className="page-title">Оформление заявки</h2>

      {/* ОБЪЕДИНЕННАЯ ФОРМА: Сохранение текста + коэффициентов доверия */}
      <form onSubmit={handleSave}>
        <h3 className="section-title">Текст хроники события</h3>
        <textarea name="history_text" placeholder="Ввести..." required value={histText} onChange={e => setHistText(e.target.value)} />

        {/* Отображение результата вычисления года */}
        <div className="event-year" style={{ marginTop: 20 }}>
          <h2>Год события</h2>
          {order.year_from_result ? (
            <p className="year-box">{order.year_from_result} — {order.year_to_result}</p>
          ) : (
            <p className="year-box">Пока не вычислено</p>
          )}
        </div>

        <br />

        {/* Карточки с коэффициентами доверия */}
        {(order.items || []).map((item: any) => (
          <div className="cart-card" key={item.id}>
            <div className="cart-card-image">
              <img src={item.image || `http://localhost:9000/images/historyPerson${item.person_id}.png`} alt={item.person_name} />
            </div>
            <div className="cart-card-content">
              <h2>{item.person_name}</h2>
              <div className="info-row">
                <p className="years">
                  Годы правления <br /><strong>{item.year_from} — {item.year_to}</strong>
                </p>
                <div className="confidence-input-container">
                  <label className="confidence-label">
                    Коэффициент доверия
                    <input
                      className="confidence-input"
                      type="number"
                      name={`confidence_${item.person_id}`}
                      min={0}
                      max={1}
                      step={0.01}
                      value={confidences[`confidence_${item.person_id}`] ?? '1'}
                      required
                      onChange={e => setConfidences({ ...confidences, [`confidence_${item.person_id}`]: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            </div>
            {/* кнопка удаления конкретного элемента
            <button type="button" className="remove-btn" onClick={() => handleRemove(item.id)}>✖</button>*/}
          </div>
        ))}

        {/* Кнопка сохранения текста и коэффициентов */}
        {/*<div className="order-buttons" style={{ marginTop: 10 }}>
          <button type="submit" className="save-btn">Сохранить</button>
        </div>*/}
      </form>

       {/*Отдельная форма для оформления заявки */}
       {/*<form onSubmit={handleMake}>
         Повторяем input для коэффициентов не нужно — мы используем state
        <div className="order-buttons" style={{ marginTop: 10 }}>
          <button type="submit" className="make-order-btn">Оформить заявку</button>
        </div>
      </form>*/}

      {/* Форма удаления заявки */}
      <div className="order-buttons" style={{ marginTop: 10 }}>
        <form onSubmit={handleDeleteOrder}>
          <button type="submit" className="remove-order-btn">Удалить заявку</button>
        </form>
      </div>

    </div>
  );
}
