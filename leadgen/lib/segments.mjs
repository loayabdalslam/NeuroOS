// Query seeds per segment. Each string is a YouTube search query; the segment is
// inherited by every channel discovered through it. Weight = fit with Neuro OS.
export const SEGMENTS = {
  LOCAL_LLM: {
    label: 'Local LLM / open-source AI',
    weight: 1.0,
    why: 'Already runs models locally; needs a shell, tools and an agent. Highest intent.',
    queries: [
      'local llm', 'ollama tutorial', 'run llm locally', 'lm studio tutorial', 'llama.cpp',
      'gguf model', 'offline ai assistant', 'local ai server', 'open source llm setup',
      'self hosted chatgpt', 'private ai local', 'local ai coding assistant', 'vllm tutorial',
      'ai on your own computer', 'run deepseek locally', 'local rag setup', 'llama 3 local',
      'quantized model tutorial', 'ai pc build llm', 'vram llm', 'text generation webui',
      'koboldcpp', 'local ai image generation', 'open webui tutorial', 'anythingllm',
      'jan ai desktop', 'msty local ai', 'lm studio vs ollama',
    ],
  },
  AI_TOOLS: {
    label: 'AI tools, reviews & news',
    weight: 0.95,
    why: 'Reviews new AI products for a living; a free Windows agent OS is reviewable content.',
    queries: [
      'best ai tools', 'ai tools 2026', 'ai news', 'new ai app', 'ai tools review',
      'chatgpt tips', 'claude ai tutorial', 'gemini ai tutorial', 'ai productivity tools',
      'free ai tools', 'ai apps you should use', 'ai software review', 'ai for work',
      'ai workflow', 'ai desktop app', 'ai assistant review', 'ai coding tools 2026',
      'top ai tools for developers', 'ai tool of the week', 'ai updates this week',
      'the best ai apps', 'ai stack', 'ai second brain', 'ai note taking app',
      'ai operating system', 'ai os', 'agentic ai demo', 'ai agents review',
    ],
  },
  AGENTIC: {
    label: 'Agentic AI / dev frameworks',
    weight: 0.95,
    why: 'Builds agents and evaluates agent products; understands tool buses and policies.',
    queries: [
      'ai agents', 'build ai agent', 'langchain tutorial', 'crewai tutorial', 'autogen tutorial',
      'mcp server tutorial', 'claude mcp', 'model context protocol', 'agentic workflow',
      'llm agents tutorial', 'ai agent framework', 'function calling llm',
      'tool use llm', 'multi agent system', 'ai agent python', 'openai agents sdk',
      'agent orchestration', 'ai agent memory', 'langgraph tutorial', 'n8n ai agent',
      'browser use agent', 'computer use ai', 'claude computer use', 'ai agent tutorial 2026',
    ],
  },
  AUTOMATION: {
    label: 'Automation / no-code',
    weight: 0.95,
    why: 'The Automation canvas is a direct competitor-adjacent surface; audience automates work.',
    queries: [
      'n8n tutorial', 'n8n workflow', 'n8n automation', 'make.com automation', 'zapier tutorial',
      'automation with ai', 'no code automation', 'ai automation agency', 'automate my work',
      'workflow automation tools', 'n8n vs make', 'self hosted automation', 'rss automation',
      'python automation scripts', 'automate repetitive tasks', 'ai workflow automation',
      'n8n ai workflow', 'business automation ai', 'automation tools 2026', 'no code app builder',
    ],
  },
  SELFHOST: {
    label: 'Self-hosting / homelab / privacy',
    weight: 0.9,
    why: 'Runs their own stack and dislikes cloud accounts; the exact worldview of the product.',
    queries: [
      'self hosted apps', 'homelab tour', 'proxmox tutorial', 'docker self hosting',
      'home server setup', 'unraid tutorial', 'nextcloud setup', 'self hosting for beginners',
      'privacy tools', 'degoogle', 'linux privacy', 'open source alternatives',
      'raspberry pi server', 'tailscale homelab', 'home assistant automation',
      'self hosted ai', 'portainer tutorial', 'nas build', 'immich', 'paperless ngx',
      'vaultwarden', 'traefik docker', 'homelab 2026', 'self host everything',
    ],
  },
  DEVPROD: {
    label: 'Developer productivity / coding',
    weight: 0.8,
    why: 'Developers are the primary builder audience; they adopt tools and show their setups.',
    queries: [
      'developer productivity', 'vs code setup', 'neovim workflow', 'coding with ai',
      'cursor ide review', 'github copilot tutorial', 'terminal setup', 'tmux workflow',
      'programming workflow', 'software engineer setup', 'dev tools you need',
      'ai coding assistant comparison', 'how i code with ai', 'keyboard driven workflow',
      'dotfiles tour', 'wsl setup', 'linux for developers', 'python developer setup',
      'cli tools', 'productivity for programmers', 'learn to code 2026', 'build in public coding',
    ],
  },
  OPENSOURCE: {
    label: 'Open source / FOSS / Linux desktop',
    weight: 0.75,
    why: 'Covers new FOSS releases; MIT desktop app is on-topic and shareable.',
    queries: [
      'open source software', 'foss alternatives', 'free software', 'linux desktop',
      'open source ai tools', 'github projects', 'awesome open source',
      'open source app review', 'linux distro review', 'kde plasma setup', 'gnome customization',
      'open source windows apps', 'github trending', 'new open source project',
    ],
  },
  PKM: {
    label: 'PKM / notes / second brain',
    weight: 0.65,
    why: 'The Brain + Notes + Spaces overlap with their workflow; lower budget, high enthusiasm.',
    queries: [
      'obsidian workflow', 'obsidian tutorial', 'notion setup', 'second brain',
      'note taking app comparison', 'pkm system', 'logseq tutorial', 'zettelkasten',
      'obsidian plugins', 'personal knowledge management', 'notes app for developers',
      'obsidian ai', 'notion ai', 'knowledge base setup', 'digital garden',
    ],
  },
  INDIEHACK: {
    label: 'Indie hackers / solo founders',
    weight: 0.6,
    why: 'Distribution-minded; may amplify a free tool, but coverage is less technical.',
    queries: [
      'indie hacking', 'build saas solo', 'solo founder', 'micro saas', 'ship fast',
      'bootstrapped startup', 'build in public', 'saas idea validation', 'no code saas',
      'one person business ai', 'ai side hustle tools', 'startup tools',
    ],
  },
  AR_TECH: {
    label: 'Arabic tech / AI (MENA)',
    weight: 0.85,
    why: 'The app ships full RTL Arabic; Arabic creators are underserved and highly responsive.',
    queries: [
      'شرح الذكاء الاصطناعي', 'أدوات الذكاء الاصطناعي', 'تعلم البرمجة من الصفر',
      'برمجة بايثون بالعربي', 'شات جي بي تي بالعربي', 'الذكاء الاصطناعي للمبتدئين',
      'أتمتة المهام', 'أدوات مجانية للكمبيوتر', 'الإنتاجية', 'تعلم الحاسوب',
      'برمجة تطبيقات', 'الذكاء الاصطناعي في العمل', 'أدوات الذكاء الاصطناعي المجانية',
      'كورس برمجة', 'شرح linux', 'السيرفر المنزلي', 'الخصوصية على الانترنت',
      'تطبيقات الذكاء الاصطناعي للاندرويد', 'مشاريع برمجية', 'الربح من البرمجة',
      'ذكاء اصطناعي محلي', 'تشغيل موديل ذكاء اصطناعي على جهازك',
    ],
  },
  ES_PT: {
    label: 'Spanish / Portuguese tech',
    weight: 0.55,
    why: 'Large volume, lower per-contact fit; useful for reach, weak for support.',
    queries: [
      'inteligencia artificial herramientas', 'automatizacion con ia', 'programacion tutorial',
      'curso de programacion', 'herramientas de ia gratis', 'automação com ia',
      'ferramentas de inteligencia artificial', 'programação para iniciantes',
      'ia local', 'productividad apps',
    ],
  },
  HI_TECH: {
    label: 'Hindi / Indian tech',
    weight: 0.5,
    why: 'Very high volume; strong tutorial culture; low sponsor budgets.',
    queries: [
      'ai tools hindi', 'chatgpt hindi', 'programming hindi', 'automation hindi',
      'free ai tools hindi', 'coding for beginners hindi', 'computer tips hindi',
      'ai se paise kaise kamaye',
    ],
  },
  DE_FR_TR: {
    label: 'German / French / Turkish tech',
    weight: 0.5,
    why: 'Strong privacy culture in DE; good early-adopter fit but slower to cover English tools.',
    queries: [
      'ki tools', 'programmieren lernen', 'datenschutz tools', 'selbst hosten',
      'outils ia', 'automatisation', 'developpement web tutorial', 'yapay zeka araclari',
      'programlama ogren', 'otomasyon',
    ],
  },
  ID_VI: {
    label: 'Indonesian / Vietnamese tech',
    weight: 0.45,
    why: 'Fast-growing creator base, price-sensitive, high volume.',
    queries: ['ai tools indonesia', 'belajar programming', 'otomatisasi', 'cong cu ai', 'hoc lap trinh'],
  },
};

export function allQueries() {
  const out = [];
  for (const [code, seg] of Object.entries(SEGMENTS)) {
    for (const q of seg.queries) out.push({ q, segment: code, weight: seg.weight, label: seg.label });
  }
  return out;
}

// Keyword signal used to score fit from a channel description / title.
export const POSITIVE = [
  ['ollama', 6], ['local llm', 6], ['local ai', 5], ['self-host', 5], ['self host', 5],
  ['homelab', 5], ['home server', 4], ['n8n', 5], ['automation', 4], ['automate', 3],
  ['agent', 4], ['agentic', 4], ['mcp', 3], ['llm', 4], ['open source', 3], ['opensource', 3],
  ['privacy', 3], ['degoogle', 4], ['obsidian', 3], ['notion', 2], ['workflow', 2],
  ['developer', 2], ['coding', 2], ['programming', 2], ['python', 2], ['javascript', 1],
  ['desktop', 2], ['windows', 2], ['linux', 2], ['docker', 2], ['terminal', 2],
  ['ai tools', 3], ['ai news', 3], ['ai review', 3], ['productivity', 2], ['second brain', 3],
  ['indie', 1], ['saas', 1], ['api', 1], ['prompt', 2], ['gpt', 2], ['claude', 3],
  ['deepseek', 4], ['qwen', 3], ['gemma', 2], ['llama', 3], ['rag', 3], ['vector database', 3],
  ['python automation', 3], ['shell', 2], ['cli', 2], ['knowledge management', 3],
  ['digital garden', 2], ['tech', 1], ['tutorial', 1], ['review', 1], ['setup', 1],
];

export const NEGATIVE = [
  ['music', 6], ['song', 6], ['lyrics', 6], ['fortnite', 8], ['minecraft', 8], ['roblox', 8],
  ['gaming', 6], ['gameplay', 6], ['vlog', 4], ['makeup', 8], ['beauty', 8], ['recipe', 8],
  ['cooking', 8], ['workout', 6], ['fitness', 6], ['kids', 6], ['cartoon', 8], ['anime', 6],
  ['movie', 5], ['trailer', 5], ['cricket', 8], ['football', 8], ['news channel', 3],
  ['asmr', 8], ['prank', 6], ['dance', 8], ['rap', 6], ['unboxing toys', 8], ['drama', 5],
  ['shorts', 2], ['reaction', 3], ['funny', 4], ['comedy', 5], ['religion', 5],
];
