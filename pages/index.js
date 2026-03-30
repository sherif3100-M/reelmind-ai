// pages/index.js
// The landing page is served from public/index.html automatically by Next.js
// This file ensures /login and /dashboard routes work via Next.js pages

export default function Home() {
  // Redirect to the static landing page
  if (typeof window !== 'undefined') {
    window.location.href = '/index.html';
  }
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: { destination: '/index.html', permanent: false },
  };
}
