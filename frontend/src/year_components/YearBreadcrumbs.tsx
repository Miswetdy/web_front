import React from 'react';
import { Breadcrumb } from 'react-bootstrap';

export default function YearBreadcrumbs({ items = [] }: { items?: { title: string; href?: string }[] }) {
  return (
    <Breadcrumb>
      {items!.map((it, idx) => (
        <Breadcrumb.Item key={idx} href={it.href} active={idx === items!.length - 1}>
          {it.title}
        </Breadcrumb.Item>
      ))}
    </Breadcrumb>
  );
}

