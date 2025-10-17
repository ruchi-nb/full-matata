"use client";

export default function EnvDebug() {
  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'black', 
      color: 'white', 
      padding: '10px', 
      zIndex: 9999,
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <div>GOOGLE_CLIENT_ID: {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'NOT SET'}</div>
      <div>Length: {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.length || 0}</div>
      <div>Type: {typeof process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}</div>
    </div>
  );
}
