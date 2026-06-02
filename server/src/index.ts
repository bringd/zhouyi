import { createApp } from './app.js'
import { config } from './config.js'

const app = createApp()

const server = app.listen(config.PORT, () => {
  console.log(`🚀 Zhouyi server listening on http://localhost:${config.PORT}`)
  console.log(`   Environment: ${config.NODE_ENV}`)
  console.log(`   CORS origin: ${config.FRONTEND_ORIGIN}`)
})

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`)
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
  // Force exit after 10s
  setTimeout(() => {
    console.error('Forced shutdown after 10s')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
