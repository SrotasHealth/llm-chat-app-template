/**
 * LLM Chat App Frontend
 *
 * Handles the chat UI interactions and communication with the backend API.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const modelSelect = document.getElementById("model-select");

// Chat state
let chatHistory = [
	{
		role: "assistant",
		content:
			"Hello! I'm an LLM chat app powered by Azure OpenAI on Cloudflare Workers. How can I help you today?",
	},
];
let isProcessing = false;

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

// Send button click handler
sendButton.addEventListener("click", sendMessage);

/**
 * Sends a message to the chat API and processes the response
 */
async function sendMessage() {
	const message = userInput.value.trim();

	// Don't send empty messages
	if (message === "" || isProcessing) return;

	// Disable input while processing
	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;
	modelSelect.disabled = true;

	// Add user message to chat
	addMessageToChat("user", message);

	// Clear input
	userInput.value = "";
	userInput.style.height = "auto";

	// Show typing indicator
	typingIndicator.classList.add("visible");

	// Add message to history
	chatHistory.push({ role: "user", content: message });

	let assistantTextEl = null;
	let metricsEl = null;
	try {
		// Create new assistant response element
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantTextEl = document.createElement("p");
		metricsEl = document.createElement("div");
		metricsEl.className = "message-metrics";
		metricsEl.textContent = "TTFS: pending | Completion: pending";
		assistantMessageEl.append(assistantTextEl, metricsEl);
		chatMessages.appendChild(assistantMessageEl);

		// Scroll to bottom
		chatMessages.scrollTop = chatMessages.scrollHeight;

		// Send request to API
		const requestStartedAt = performance.now();
		let ttfsMs = null;
		let completionMs = null;
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: chatHistory,
				model: modelSelect.value,
			}),
		});

		// Handle errors
		if (!response.ok) {
			let errorMessage = "Failed to get response";
			try {
				const errorBody = await response.json();
				errorMessage = errorBody.details || errorBody.error || errorMessage;
			} catch {
				errorMessage = await response.text();
			}
			throw new Error(errorMessage);
		}
		if (!response.body) {
			throw new Error("Response body is null");
		}

		// Process streaming response
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let responseText = "";
		let buffer = "";
		const flushAssistantText = () => {
			assistantTextEl.textContent = responseText;
			chatMessages.scrollTop = chatMessages.scrollHeight;
		};
		const updateMetrics = () => {
			const ttfs = ttfsMs === null ? "pending" : `${ttfsMs} ms`;
			const completion =
				completionMs === null ? "pending" : `${completionMs} ms`;
			metricsEl.textContent = `TTFS: ${ttfs} | Completion: ${completion}`;
		};
		const handleSseData = (data) => {
			if (data === "[DONE]") {
				return true;
			}
			try {
				const jsonData = JSON.parse(data);
				// Handle both Workers AI format (response) and OpenAI format (choices[0].delta.content)
				let content = "";
				if (
					typeof jsonData.response === "string" &&
					jsonData.response.length > 0
				) {
					content = jsonData.response;
				} else if (jsonData.choices?.[0]?.delta?.content) {
					content = jsonData.choices[0].delta.content;
				}
				if (content) {
					if (ttfsMs === null) {
						ttfsMs = Math.round(performance.now() - requestStartedAt);
						updateMetrics();
					}
					responseText += content;
					flushAssistantText();
				}
			} catch (e) {
				console.error("Error parsing SSE data as JSON:", e, data);
			}
			return false;
		};

		let sawDone = false;
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				// Process any remaining complete events in buffer
				const parsed = consumeSseEvents(buffer + "\n\n");
				for (const data of parsed.events) {
					if (handleSseData(data)) {
						break;
					}
				}
				break;
			}

			// Decode chunk
			buffer += decoder.decode(value, { stream: true });
			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;
			for (const data of parsed.events) {
				if (handleSseData(data)) {
					sawDone = true;
					buffer = "";
					break;
				}
			}
			if (sawDone) {
				break;
			}
		}
		completionMs = Math.round(performance.now() - requestStartedAt);
		updateMetrics();

		// Add completed response to chat history
		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });
		}
	} catch (error) {
		console.error("Error:", error);
		const errorMessage = `Sorry, there was an error processing your request: ${error.message}`;
		if (assistantTextEl && metricsEl) {
			assistantTextEl.textContent = errorMessage;
			metricsEl.textContent = "";
		} else {
			addMessageToChat("assistant", errorMessage);
		}
	} finally {
		// Hide typing indicator
		typingIndicator.classList.remove("visible");

		// Re-enable input
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		modelSelect.disabled = false;
		userInput.focus();
	}
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	const textEl = document.createElement("p");
	textEl.textContent = content;
	messageEl.appendChild(textEl);
	chatMessages.appendChild(messageEl);

	// Scroll to bottom
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let eventEndIndex;
	while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
		const rawEvent = normalized.slice(0, eventEndIndex);
		normalized = normalized.slice(eventEndIndex + 2);

		const lines = rawEvent.split("\n");
		const dataLines = [];
		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(line.slice("data:".length).trimStart());
			}
		}
		if (dataLines.length === 0) continue;
		events.push(dataLines.join("\n"));
	}
	return { events, buffer: normalized };
}
