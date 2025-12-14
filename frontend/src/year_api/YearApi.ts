import type { YearPerson } from '../year_types/YearTypes';
// import local mock JSON (tsconfig resolveJsonModule must be enabled)
import personsMock from '../mock/persons.json';

// Small default PNG as data URI (grey 32x32). This avoids needing a separate binary file in mock.
const MOCK_IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAABi5+0RAAAACXBIWXMAAAsTAAALEwEAmpwYAAABK0lEQVRIie3VvUoDQRjG8Y8sREoUBFREH0Al9hYh9hY2Cw8gq2h2RrY2trY2gq2gq2i6sZQn8Qv9yZ3r5kz7szqfJmX3mTM5v8zLwF8s4e6gq2g3wGxwBzwAK8AV8Bv4DbgD3g6w4k6BlgK3gQz3B0r0kH4Cx4wD3gF3gI3gJ3gID8gqXzyzqgkMPAB3wF+gCvAq8BM4E/4mGv8P3tqv0pH8p0W8wGvYg7wNnqf5s8gq2gK9iH3QOp3g63w61gGvwE3gB3gD3g6w6kKq7H5a3dJ6p0e8gD7wE3gG3gG3gG3wA1q0G0gE8wCf4Cr3+Ad5q0j1lkeqP7s1p1h2+Qe7v0wWnY2sQAAAABJRU5ErkJggg==';

function normalizeImageField(image: any): string | null {
  if (!image) return null;
  const img = String(image).trim();
  if (!img) return null;
  // data URL
  if (img.startsWith('data:')) return img;
  // already absolute
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  // if starts with // keep origin protocol
  if (img.startsWith('//')) return window.location.protocol + img;
  // relative path starting with / -> make absolute using current origin
  if (img.startsWith('/')) return window.location.origin + img;
  // otherwise assume relative to media root -> prefix with origin + '/'
  return window.location.origin + '/' + img.replace(/^\/+/, '');
}

export async function getPersons(): Promise<YearPerson[]> {
  try {
    const resp = await fetch('/api/persons/');
    if (!resp.ok) throw new Error('network');
    const data = await resp.json();
    return (data || []).map((p: any) => ({
      ...p,
      image: normalizeImageField(p.image)
    }));
  } catch (e) {
    // try Django mock endpoint
    try {
      const resp2 = await fetch('/api/persons/?mock=1');
      if (resp2.ok) {
        const d = await resp2.json();
        return (d || []).map((p: any) => ({ ...p, image: normalizeImageField(p.image) }));
      }
    } catch (_) {}

    // fallback to local mock JSON bundled with the frontend
    try {
      const local: any[] = (personsMock as any) || [];
      return local.map((p: any) => ({
        ...p,
        image: normalizeImageField(p.image || MOCK_IMAGE_DATA_URL)
      }));
    } catch (_) {
      // ultimate fallback hard-coded
      return [
        { id: 1, person_name: 'Иванов Иван', year_from: 1850, year_to: 1900, description: 'Описание Ивана', image: MOCK_IMAGE_DATA_URL },
        { id: 2, person_name: 'Петров Пётр', year_from: 1870, year_to: 1920, description: 'Описание Петра', image: MOCK_IMAGE_DATA_URL }
      ];
    }
  }
}

export async function getPersonById(id: number): Promise<YearPerson | null> {
  try {
    const resp = await fetch(`/api/persons/${id}/`);
    if (!resp.ok) throw new Error('not found');
    const p = await resp.json();
    return { ...p, image: normalizeImageField(p.image) };
  } catch (e) {
    const all = await getPersons();
    return all.find(p => p.id === id) || null;
  }
}

export async function getCurrentOrder(): Promise<any> {
  try {
    const resp = await fetch('/api/order/current/');
    if (!resp.ok) throw new Error('no order');
    const order = await resp.json();
    if (!order || !order.order_id) return order;

    // enrich items with images by fetching persons list (best-effort)
    try {
      const persons = await getPersons();
      const map = new Map<number, string | null>();
      persons.forEach((p: any) => map.set(p.id, p.image || null));
      order.items = (order.items || []).map((it: any) => ({ ...it, image: map.get(it.person_id) || null }));
    } catch (_) {
      // ignore
    }

    return order;
  } catch (e) {
    throw e;
  }
}

export async function addToOrder(personId: number): Promise<any> {
  const resp = await fetch(`/api/order/add/${personId}/`, { method: 'POST' });
  return await resp.json();
}

export async function removeOrderItem(itemId: number): Promise<any> {
  const resp = await fetch(`/api/order/item/remove/${itemId}/`, { method: 'POST' });
  return await resp.json();
}

export async function saveOrder(orderId: number, payload: any): Promise<any> {
  const resp = await fetch(`/api/order/save/${orderId}/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return await resp.json();
}

export async function makeOrder(orderId: number, confidences: any): Promise<any> {
  const resp = await fetch(`/api/order/make/${orderId}/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(confidences) });
  return await resp.json();
}
