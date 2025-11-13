import React from 'react';
import { Breadcrumb } from 'react-bootstrap';

// Самописный компонент breadcrumb: принимает items = [{title, href}] и рендерит цепочку
export default function Breadcrumbs({ items = [] }) {
  return (
    <Breadcrumb>
      {items.map((it, idx) => (
        <Breadcrumb.Item key={idx} href={it.href} active={idx === items.length - 1}>
          {it.title}
        </Breadcrumb.Item>
      ))}
    </Breadcrumb>
  );
}
