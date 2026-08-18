import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { readFileSync } from "node:fs"

import {
  createAuthMiddleware,
  getConfiguredAdminApiKeys,
} from "./lib/request-auth"
import { traceIdMiddleware } from "./lib/trace"
import { zstdDecompressionMiddleware } from "./lib/zstd-request"
import { apiJsonRoutes } from "./routes/api-json/route"
import { completionRoutes } from "./routes/chat-completions/route"
import { configRoutes } from "./routes/admin/config/route"
import { embeddingRoutes } from "./routes/embeddings/route"
import { messageRoutes } from "./routes/messages/route"
import { modelRoutes } from "./routes/models/route"
import { providerMessageRoutes } from "./routes/provider/messages/route"
import { providerModelRoutes } from "./routes/provider/models/route"
import { responsesRoutes } from "./routes/responses/route"
import { tokenUsageRoute } from "./routes/token-usage/route"
import { tokenRoute } from "./routes/token/route"
import { usageRoute } from "./routes/usage/route"

export const server = new Hono()

server.use(traceIdMiddleware)
server.use(logger())
server.use(cors())
server.use(
  "*",
  createAuthMiddleware({
    allowUnauthenticatedPaths: ["/", "/usage-viewer", "/usage-viewer/"],
    shouldSkipPath: (path) => path.startsWith("/admin/"),
  }),
)
server.use(
  "/admin/*",
  createAuthMiddleware({
    getApiKeys: getConfiguredAdminApiKeys,
    allowUnauthenticatedPaths: [],
    allowWhenNoApiKeys: false,
  }),
)
server.use(zstdDecompressionMiddleware)

// models.dev-compatible api.json for Kimi Code custom registry import
// Serve at both "/" and "/api.json" — Kimi Code's custom registry
// fetches the URL as-is (often the bare root).
server.route("/api.json", apiJsonRoutes)
server.get("/", (c) => {
  // If the request looks like a catalog fetch (accepts JSON), serve api.json
  const accept = c.req.header("accept") ?? ""
  if (accept.includes("application/json") || accept.includes("*/*")) {
    // Forward to the api.json handler
    return apiJsonRoutes.fetch(c.req.raw)
  }
  return c.text("Server running")
})

server.get("/usage-viewer", (c) => {
  const usageViewerFileUrl = new URL("../pages/index.html", import.meta.url)
  return c.html(readFileSync(usageViewerFileUrl, "utf8"))
})
server.get("/usage-viewer/", (c) => c.redirect("/usage-viewer", 301))

server.route("/chat/completions", completionRoutes)
server.route("/admin/config", configRoutes)
server.route("/models", modelRoutes)
server.route("/embeddings", embeddingRoutes)
server.route("/usage", usageRoute)
server.route("/token-usage", tokenUsageRoute)
server.route("/token", tokenRoute)
server.route("/responses", responsesRoutes)

// Compatibility with tools that expect v1/ prefix
server.route("/v1/chat/completions", completionRoutes)
server.route("/v1/models", modelRoutes)
server.route("/v1/embeddings", embeddingRoutes)
server.route("/v1/responses", responsesRoutes)

// Anthropic compatible endpoints
server.route("/v1/messages", messageRoutes)

// Provider scoped Anthropic-compatible endpoints
server.route("/:provider/v1/messages", providerMessageRoutes)
server.route("/:provider/v1/models", providerModelRoutes)
