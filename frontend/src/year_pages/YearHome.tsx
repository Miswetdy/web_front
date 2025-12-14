import React, { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { getPersons, getCurrentOrder } from '../year_api/YearApi';
import YearPersonCard from '../year_components/YearPersonCard';
import type { YearPerson } from '../year_types/YearTypes';
import '../styles/base.css'
import '../styles/index.css'
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setQuery } from '../store/servicesFilterSlice';

export default function YearHome() {
  const [persons, setPersons] = useState<YearPerson[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const query = useAppSelector((state) => state.servicesFilter.query);
  const dispatch = useAppDispatch();

  useEffect(() => {
    let mounted = true;
    getPersons().then(data => {
      if (!mounted) return;
      setPersons(data);
      setLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setPersons([]);
      setLoading(false);
    });
    getCurrentOrder().then(o=>{ if (mounted) setOrderInfo(o); }).catch(()=>{});

    // слушаем кастомное событие, которое диспатчится при добавлении в заявку
    function onOrderUpdated() {
      getCurrentOrder().then(o=>{ if (mounted) setOrderInfo(o); }).catch(()=>{});
    }
    window.addEventListener('order-updated', onOrderUpdated as EventListener);

    return () => { mounted = false; window.removeEventListener('order-updated', onOrderUpdated as EventListener) };
  }, []);

  const filtered = persons ? persons.filter(p=> p.person_name.toLowerCase().includes(query.toLowerCase())) : [];

  return (
      <div>
      <div className="head-container">
        <form onSubmit={e=>{e.preventDefault();}}>
          <div className="input-container">
            <input type="text" placeholder="Поиск..." value={query} onChange={e=>dispatch(setQuery(e.target.value))} />
            <button type="submit" className="search-button">
                <img src="http://localhost:9000/images/lupa.png" alt="Search Icon" className="search-icon" />
            </button>
          </div>
        </form>
        {orderInfo && orderInfo.order_id ? (
          // use SPA Link for internal navigation; still keep href in case someone copies the URL
          <Link to={`/orderForPredictingYear/${orderInfo.order_id}/`} className="cart-button" title="Открыть заявку">
            <img src="http://localhost:9000/images/cartOfPersons.png" alt="cart" />
            <span className="cart-counter">{(orderInfo.items || []).length}</span>
          </Link>
        ) : (
          <div className="cart-button disabled"><img src="http://localhost:9000/images/cartOfPersons.png" alt="cart" /></div>
        )}
      </div>

      {loading && <div style={{ padding: '20px' }}><Spinner animation="border" /></div>}
        {!loading && filtered.length === 0 && (<p>Ничего не найдено</p>)}

      <div className="cards-container">
        {filtered.map(p => (
            <YearPersonCard key={p.id} person={p} />
        ))}
      </div>
    </div>
  );
}
