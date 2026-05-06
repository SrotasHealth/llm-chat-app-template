/**
 * LLM Chat Application Template
 *
 * A simple chat application using Azure OpenAI from Cloudflare Workers.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env, ctx);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		const startedAt = performance.now();
		const azureResponse = await fetch(getAzureChatCompletionsUrl(env), {
			method: "POST",
			headers: {
				"api-key": env.AZURE_OPENAI_API_KEY,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				messages,
				max_completion_tokens: 1024,
				reasoning_effort: "none",
				stream: true,
			}),
		});
		const upstreamStartedMs = Math.round(performance.now() - startedAt);

		if (!azureResponse.ok || !azureResponse.body) {
			const errorBody = await azureResponse.text();
			console.error("Azure OpenAI request failed:", {
				status: azureResponse.status,
				statusText: azureResponse.statusText,
				body: errorBody,
				upstreamStartedMs,
			});
			return new Response(
				JSON.stringify({
					error: "Azure OpenAI request failed",
					status: azureResponse.status,
					details: errorBody,
				}),
				{
					status: 502,
					headers: { "content-type": "application/json" },
				},
			);
		}

		const { stream, getFirstTokenLatencyMs } = trackStreamingLatency(
			azureResponse.body,
			startedAt,
		);
		const [clientStream, metricsStream] = stream.tee();

		ctx.waitUntil(
			(async () => {
				await streamFinished(metricsStream);
				const completedMs = Math.round(performance.now() - startedAt);
				console.info("Azure OpenAI latency", {
					upstreamStartedMs,
					firstTokenMs: getFirstTokenLatencyMs(),
					completedMs,
					deployment: env.AZURE_OPENAI_DEPLOYMENT,
				});
			})(),
		);

		return new Response(clientStream, {
			headers: {
				"content-type":
					azureResponse.headers.get("content-type") ??
					"text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
				"server-timing": `azure_upstream;dur=${upstreamStartedMs}`,
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}

function getAzureChatCompletionsUrl(env: Env): string {
	const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "");
	const deployment = encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT);
	const apiVersion = encodeURIComponent(env.AZURE_OPENAI_API_VERSION);

	return `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
}

function trackStreamingLatency(
	body: ReadableStream<Uint8Array>,
	startedAt: number,
): {
	stream: ReadableStream<Uint8Array>;
	getFirstTokenLatencyMs: () => number | null;
} {
	let firstTokenLatencyMs: number | null = null;

	const stream = body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				if (firstTokenLatencyMs === null && chunk.byteLength > 0) {
					firstTokenLatencyMs = Math.round(performance.now() - startedAt);
				}
				controller.enqueue(chunk);
			},
		}),
	);

	return {
		stream,
		getFirstTokenLatencyMs: () => firstTokenLatencyMs,
	};
}

async function streamFinished(stream: ReadableStream<Uint8Array>): Promise<void> {
	const reader = stream.getReader();
	try {
		while (!(await reader.read()).done) {
			// Drain the cloned stream so total latency is logged after Azure finishes.
		}
	} finally {
		reader.releaseLock();
	}
}
