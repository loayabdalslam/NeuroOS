/**
 * A streaming provider adapter implemented entirely in JavaScript.
 *
 * The host consumes this async generator and normalises its events into the
 * same pipeline used by the built-in OpenAI/Anthropic/Gemini adapters:
 *
 *   yield { type: 'text', delta: '…' }
 *   yield { type: 'reasoning', delta: '…' }
 *   yield { type: 'tool_call', call: { id, name, args } }
 *   yield { type: 'usage', usage: { input, output } }
 *   yield { type: 'done' }
 */

module.exports = {
  adapters: {
    async *echo(request) {
      const messages = request.messages || [];
      const last = messages.filter((message) => message.role === 'user').pop();
      const text = String(last ? last.content : 'Hello from the local echo provider.');
      const words = text.split(/\s+/).filter(Boolean);

      yield { type: 'text', delta: '**Local echo** — you said:\n\n' };
      for (const word of words.slice(0, 60)) {
        // Simulate streaming latency so the UI feels real.
        await new Promise((resolve) => setTimeout(resolve, 28));
        yield { type: 'text', delta: `${word} ` };
      }
      yield { type: 'usage', usage: { input: text.length, output: text.length } };
      yield { type: 'done' };
    },
  },
};
