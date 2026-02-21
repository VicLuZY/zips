import 'dotenv/config'
import cors from 'cors'
import express from 'express'

const app = express()
const port = Number(process.env.PORT) || 8080

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/search', (req, res) => {
  const { q = '' } = req.query
  res.json({
    query: q,
    results: [],
    message: 'Search endpoint scaffold is ready.'
  })
})

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`)
})
