import fs from 'fs'
import path from 'path'

export default function Home({ html }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

export async function getServerSideProps() {
  const filePath = path.join(process.cwd(), 'public', 'app.html')
  const html = fs.readFileSync(filePath, 'utf8')
  // Extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  return {
    props: { html: bodyMatch ? bodyMatch[1] : html }
  }
}