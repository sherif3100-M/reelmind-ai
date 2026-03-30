export async function getServerSideProps({ res }) {
  res.setHeader('Cache-Control', 'no-store')
  res.writeHead(302, { Location: '/app.html' })
  res.end()
  return { props: {} }
}

export default function Home() {
  return null
}