import { Hono } from "hono"

import { state } from "~/lib/state"
import { cacheModels } from "~/lib/utils"

export const apiJsonRoutes = new Hono()

/**
 * models.dev-compatible /api.json endpoint.
 *
 * Transforms the cached Copilot models into the models.dev catalog format
 * so Kimi Code (and other tools) can import providers/models via:
 *   kimi provider add http://localhost:4141/api.json --api-key <token>
 *
 * Served at both "/" and "/api.json" for maximum compatibility.
 */
apiJsonRoutes.get("/", async (c) => {
  try {
    if (!state.models) {
      await cacheModels()
    }

    const models = state.models?.data ?? []
    const host = new URL(c.req.url).host

    const catalog: Record<string, unknown> = {
      "github-copilot": {
        id: "github-copilot",
        name: "GitHub Copilot",
        api: `http://${host}/v1`,
        type: "openai",
        npm: "@ai-sdk/openai-compatible",
        env: ["GITHUB_TOKEN"],
        doc: "https://docs.github.com/en/copilot",
        models: Object.fromEntries(
          models
            .filter((m) => m.capabilities.type !== "embeddings")
            .map((model) => {
              const is1m =
                model.capabilities.limits?.max_context_window_tokens
                === 1_000_000
              const modelId = is1m ? `${model.id}[1m]` : model.id

              const context =
                model.capabilities.limits?.max_context_window_tokens ?? 0
              const output = model.capabilities.limits?.max_output_tokens ?? 0

              const supports = model.capabilities.supports ?? {}
              const hasReasoning =
                (supports.reasoning_effort?.length ?? 0) > 0
                || model.capabilities.family === "o3"
                || model.capabilities.family === "o4"

              const modalities: { input: string[]; output: string[] } = {
                input: ["text"],
                output: ["text"],
              }
              if (supports.vision) {
                modalities.input.push("image")
              }

              const modelEntry: Record<string, unknown> = {
                id: modelId,
                name: model.name,
                description: `${model.name} via GitHub Copilot`,
                family: model.capabilities.family,
                attachment: !!supports.vision,
                reasoning: hasReasoning,
                reasoning_options:
                  hasReasoning ?
                    [
                      {
                        type: "effort",
                        values: supports.reasoning_effort ?? [
                          "low",
                          "medium",
                          "high",
                        ],
                      },
                    ]
                  : [],
                tool_call: supports.tool_calls ?? false,
                structured_output: supports.structured_outputs ?? false,
                temperature: true,
                modalities,
                open_weights: false,
              }

              // Add limit if we have context/output info
              if (context > 0 || output > 0) {
                const limit: Record<string, number> = {}
                if (context > 0) limit.context = context
                if (output > 0) limit.output = output
                modelEntry.limit = limit
              }

              // Add input limit if available
              if (
                model.capabilities.limits?.max_prompt_tokens
                && model.capabilities.limits.max_prompt_tokens
                  < (model.capabilities.limits?.max_context_window_tokens ?? 0)
              ) {
                ;(modelEntry.limit as Record<string, number>).input =
                  model.capabilities.limits.max_prompt_tokens
              }

              return [modelId, modelEntry]
            }),
        ),
      },
    }

    return c.json(catalog)
  } catch (error) {
    console.error("[api.json] Error building catalog:", error)
    return c.json({ error: "Failed to build catalog" }, 500)
  }
})
