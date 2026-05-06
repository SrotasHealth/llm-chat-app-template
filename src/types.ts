/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
	/**
	 * Azure OpenAI resource endpoint, for example:
	 * https://my-resource.openai.azure.com
	 */
	AZURE_OPENAI_ENDPOINT: string;

	/**
	 * Azure OpenAI deployment name for the hosted model.
	 */
	AZURE_OPENAI_DEPLOYMENT: string;

	/**
	 * Azure OpenAI API version.
	 */
	AZURE_OPENAI_API_VERSION: string;

	/**
	 * Azure OpenAI API key. Store this as a Wrangler secret.
	 */
	AZURE_OPENAI_API_KEY: string;

	/**
	 * Binding for static assets.
	 */
	ASSETS: { fetch: (request: Request) => Promise<Response> };
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}
