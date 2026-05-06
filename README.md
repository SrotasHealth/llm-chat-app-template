# LLM Chat Application Template

A simple, ready-to-deploy chat application template powered by Azure OpenAI on Cloudflare Workers. This template provides a clean starting point for building AI chat applications with streaming responses and measuring upstream latency.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/llm-chat-app-template)

<!-- dash-content-start -->

## Demo

This template demonstrates how to build an AI-powered chat interface using Azure OpenAI with streaming responses from a Cloudflare Worker. It features:

- Real-time streaming of AI responses using Server-Sent Events (SSE)
- Easy customization of models and system prompts
- Azure OpenAI first-token and total latency logging
- Clean, responsive UI that works on mobile and desktop

## Features

- 💬 Simple and responsive chat interface
- ⚡ Server-Sent Events (SSE) for streaming responses
- 🧠 Powered by an Azure OpenAI hosted model
- 🛠️ Built with TypeScript and Cloudflare Workers
- 📱 Mobile-friendly design
- 🔄 Maintains chat history on the client
- 🔎 Built-in Observability logging
<!-- dash-content-end -->

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- A Cloudflare account
- An Azure OpenAI resource with a chat model deployment

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/cloudflare/templates.git
   cd templates/llm-chat-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Generate Worker type definitions:
   ```bash
   npm run cf-typegen
   ```

4. Configure Azure OpenAI:

   Update the non-secret values in `wrangler.jsonc`:

   ```jsonc
   "vars": {
     "AZURE_OPENAI_ENDPOINT": "https://YOUR_RESOURCE_NAME.openai.azure.com",
     "AZURE_OPENAI_DEPLOYMENT": "YOUR_DEPLOYMENT_NAME",
     "AZURE_OPENAI_API_VERSION": "2024-10-21"
   }
   ```

   Store the API key as a Wrangler secret:

   ```bash
   npx wrangler secret put AZURE_OPENAI_API_KEY
   ```

### Development

Start a local development server:

```bash
npm run dev
```

This will start a local server at http://localhost:8787.

Note: Chat requests call your Azure OpenAI deployment, which may incur Azure usage charges.

### Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

### Monitor

View real-time logs associated with any deployed Worker:

```bash
npx wrangler tail
```

## Project Structure

```
/
├── public/             # Static assets
│   ├── index.html      # Chat UI HTML
│   └── chat.js         # Chat UI frontend script
├── src/
│   ├── index.ts        # Main Worker entry point
│   └── types.ts        # TypeScript type definitions
├── test/               # Test files
├── wrangler.jsonc      # Cloudflare Worker configuration
├── tsconfig.json       # TypeScript configuration
└── README.md           # This documentation
```

## How It Works

### Backend

The backend is built with Cloudflare Workers and calls Azure OpenAI to generate responses. The main components are:

1. **API Endpoint** (`/api/chat`): Accepts POST requests with chat messages and streams responses
2. **Streaming**: Uses Server-Sent Events (SSE) for real-time streaming of AI responses
3. **Latency logging**: Logs upstream connection, first-token, and total completion timing to Worker logs

### Frontend

The frontend is a simple HTML/CSS/JavaScript application that:

1. Presents a chat interface
2. Sends user messages to the API
3. Processes streaming responses in real-time
4. Maintains chat history on the client side

## Customization

### Changing the Model

To use a different Azure OpenAI hosted model, deploy that model in Azure OpenAI and update `AZURE_OPENAI_DEPLOYMENT` in `wrangler.jsonc`.

### Checking Latency

The Worker logs Azure OpenAI timing for each `/api/chat` request:

- `upstreamStartedMs`: time until Azure returns response headers
- `firstTokenMs`: time until the first streamed bytes arrive
- `completedMs`: total time until the stream finishes

View deployed logs with:

```bash
npx wrangler tail
```

### Modifying the System Prompt

The default system prompt can be changed by updating the `SYSTEM_PROMPT` constant in `src/index.ts`.

### Styling

The UI styling is contained in the `<style>` section of `public/index.html`. You can modify the CSS variables at the top to quickly change the color scheme.

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Azure OpenAI Documentation](https://learn.microsoft.com/azure/ai-services/openai/)
