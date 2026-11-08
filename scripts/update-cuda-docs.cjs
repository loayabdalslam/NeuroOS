const fs = require('fs');
let b = fs.readFileSync('BUGS.md', 'utf8');
if (!b.includes('## Ollama CUDA crash')) {
  b += [
    '',
    '## Ollama CUDA crash (environment)',
    '',
    '| Symptom | Cause / fix |',
    '| --- | --- |',
    '| `HTTP 500 — llama-server process has terminated … 0xc0000409 … CUDA error: device kernel image is invalid` on every Ollama model. | The Ollama CUDA 12 runner crashes on this machine (RTX 3050, NVIDIA driver 546.18, Ollama 0.40.14) before inference starts. Forced the CPU backend with `OLLAMA_LLM_LIBRARY=cpu` (persisted at user level) and restarted `ollama serve`; `gemma3:4b` then answered `CPU_OK` in ~12 s. Proper long-term fix: update the NVIDIA driver, then remove the variable to use the GPU again. |',
    '| The raw CUDA text was shown as the assistant error. | The OpenAI-compatible adapter now detects `CUDA error` / `llama-server process` and returns an actionable message (restart Ollama, force CPU, or update the driver) with the detail appended. |',
    '',
  ].join('\n');
  fs.writeFileSync('BUGS.md', b, 'utf8');
}
console.log('cuda docs updated');
