import React from 'react';

export default function HttpMethod({children}) {
  const method = String(children).toUpperCase();
  return <span className={`ob-http-method ob-http-method--${method.toLowerCase()}`}>{method}</span>;
}
