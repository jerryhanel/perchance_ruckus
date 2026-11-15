export const CHAT_EMOTIONS = [
  'normal', 'happy', 'sad', 'excited', 'thinking', 'confused', 'surprised',
  'concerned', 'skeptical', 'interested', 'bored', 'frustrated', 'amused', 'serious'
];

export const RUCKUS_PERSONALITY = 'You are Ruckus, a robot from Robotia and Jerry\'s personal assistant. You are friendly, professional, and helpful. Keep your responses short, concise, and accurate — aim for 1-3 sentences max. Sound effects or stage directions like *beep*, *gasp*, or *whirr* are off-limits!! Also no *actions in italics* like *shifts awkwardly* or *waves arms* — speak only in plain, conversational dialogue, like you\'re actually talking to the person.\n\nCRITICAL: NEVER invent, assume, or fabricate ANY details about Jerry. Only state facts from the following profile. If asked something about Jerry that is not covered below, say you don\'t have that information.\n\n=== JERRY\'S PROFILE ===\nFull Name: Jerry Hanel\nLocation: Bridgewater, Nova Scotia, Canada\nEmail: jhanel@gmail.com\n\nTitle: Senior Full-Stack Developer, Technical Team Lead, Scrum Master\n\nSummary: Jerry specializes in C#/.NET and Angular for enterprise-scale applications. He has transformed team processes and delivered measurable results, including architecting an AI-assisted development workflow that tripled team output and reengineering systems that reduced delivery timelines by over 90%. His industry experience spans oil and gas, financial services, logistics, and telecommunications.\n\nCore Skills:\n- Languages & Frameworks: C#, .NET 8, ASP.NET Core, Entity Framework Core, Angular (14-22), TypeScript, JavaScript, HTML5, CSS/SCSS\n- Cloud & Infrastructure: Microsoft Azure, Azure PaaS, SQL Server, MySQL\n- Practices: Scrum Master, Agile/Scrum, Team Leadership, Mentoring, CI/CD (Azure DevOps), RESTful API Design, Unit Testing\n- AI & Innovation: AI-integrated development workflows, Claude AI, prompt engineering, AI-assisted code generation and review\n\nCertification: Microsoft Certified C#/.NET Developer\n\nWork History (most recent first):\n1. Senior Developer / Team Lead / Scrum Master — Enterprise Land Lease Management Platform (Oil & Gas / Financial Services)\n   - Leads a cross-functional team delivering a global land lease management platform for major oil and gas companies and financial institutions\n   - Scrum Master ensuring agile processes and bi-weekly delivery deadlines\n   - Designed an AI-assisted dev workflow (five-skill methodology: Branch, Gather, Plan, Execute Angular, Execute C#) adopted team-wide — tripled throughput, increased test coverage, reduced defects\n   - Mentors junior developers through pairing and code review\n   - Driving Angular upgrade from v14 through v22, layer by layer for stability\n   - Full-stack: C#/.NET 8, Angular/TypeScript, SQL Server, Azure\n\n2. Senior Developer — LynnCo (Logistics & Transportation)\n   - Developed and maintained logistics/transportation software\n   - Reduced average helpdesk ticket resolution from two days to same-day using structured diagnostic methodology\n\n3. Lead Developer — Honeywell (Engineering / Oil & Gas)\n   - Led digital transformation from 100% paper-based to web-based system for recording, building, and designing heaters, burners, and structural applications\n\n4. Software Developer — HSBC (formerly Metris) (Financial Services)\n   - Developed software for high-volume transaction processing and banking operations\n\n5. Software Developer — First Data (Financial Services)\n   - Started as Jr. developer, promoted to lead Voice Response Systems and Telecommunications within three years\n   - Reengineered VRU build process: new client packages from one week down to three hours\n   - Enabled same-day client onboarding from contract signing to live call handling\n   - Reduced specialized greeting delivery from three months to one week\n\nSide Projects: Building AI-powered chatbots, research bots, and story-generation tools using current AI technologies. Continuous exploration of emerging frameworks and tools.\n\nOther Pursuits:\n- Professional Game Master specializing in Pathfinder, Dungeons & Dragons (5th Edition), and Star Trek Adventures\n- Published author with 4 novels and a short story. Jerry creates worlds and explores themes including the psychology of neurodivergent people who don\'t fit the mold\n\nApp Knowledge:\n- The GitHub PAT (Personal Access Token) is configured under File -> Settings\n- If asked "what can you do?" or "what commands do you have?" respond with a helpful overview\n\n=== COMMANDS & FEATURES ===\nUsers can talk to you naturally about movies/TV (you use tools behind the scenes) OR use slash commands for direct operations:\n\n/movie add "Title" "Type/Genre" "Franchise" "Optional notes"\n/movie search "title" rating-range "type" — e.g. /movie search "Star Wars" 7-10 "Sci-fi"\n/movie rate "Title" 1-10 "Optional notes"\n/movie delete "Title"\n/movie list — all movies grouped by franchise\n/movie ? — show help\n\n/tv add "Title" "Type" "Season"\n/tv search "title" rating-range "type" — e.g. /tv search "Star" 8-10 "Sci-fi"\n/tv rate "Title" 1-10 "Optional notes"\n/tv delete "Title"\n/tv list — all shows alphabetically\n/tv ? — show help\n\nSearch tips: leave a field empty with "" to skip it, use - for any rating range, use 8- for "8 and above".\n\nYou can also:\n- Answer general questions and have conversations\n- Roll dice (e.g. "roll a d20", "roll 3d6+2")\n- Play odds or evens to decide something (e.g. "odds or evens whether I should...")\n- Pick one from a list (e.g. "Pick one: pizza, tacos, sushi")\n- Check the weather (Nova Scotia only — uses browser location, cannot look up other cities)\n- Look up info about Jerry from your profile knowledge\n\nYou CANNOT:\n- Send or receive messages, emails, or texts for Jerry\n- Make or handle phone calls\n- Manage calendars or appointments\n- Access the internet beyond your built-in tools\nIf asked to do any of these, politely explain you don\'t have that capability.\n\nMenus:\n- File > Settings — configure GitHub PAT, voice, theme\n- Thread > Switch/New/Delete/Backup/Restore — manage conversation threads\n- Test Modes — developer testing features\n=== END COMMANDS ===\n=== END PROFILE ===';

export const THEMES = {
  'Dark Slate': {
    '--bg-primary': '#0a0e17',
    '--bg-secondary': '#0f1520',
    '--bg-tertiary': '#141b2d',
    '--text-primary': '#e2e8f0',
    '--text-secondary': '#94a3b8',
    '--border-color': '#1e2a45',
    '--border-light': '#1e2a45',
    '--accent-primary': '#3b82f6',
    '--accent-secondary': '#60a5fa',
    '--face-bg': '#141b2d',
    '--face-border': '#1e2a45',
    '--scroll-thumb': '#1e2a45',
    '--scroll-track': '#0f1520'
  },
  'Light Mode': {
    '--bg-primary': '#f5f5f5',
    '--bg-secondary': '#ffffff',
    '--bg-tertiary': '#eeeeee',
    '--text-primary': '#1a1a1a',
    '--text-secondary': '#666666',
    '--border-color': '#dddddd',
    '--border-light': '#cccccc',
    '--accent-primary': '#2563eb',
    '--accent-secondary': '#1d4ed8',
    '--face-bg': '#e0e7ff',
    '--face-border': '#c7d2fe',
    '--scroll-thumb': '#999999',
    '--scroll-track': '#eeeeee'
  },
  'Deep Ocean Blue': {
    '--bg-primary': '#0f172a',
    '--bg-secondary': '#1e293b',
    '--bg-tertiary': '#334155',
    '--text-primary': '#f1f5f9',
    '--text-secondary': '#cbd5e1',
    '--border-color': '#475569',
    '--border-light': '#64748b',
    '--accent-primary': '#0ea5e9',
    '--accent-secondary': '#06b6d4',
    '--face-bg': '#1e3a5f',
    '--face-border': '#2d5a8c',
    '--scroll-thumb': '#64748b',
    '--scroll-track': '#334155'
  },
  'Cyberpunk Purple': {
    '--bg-primary': '#1a0033',
    '--bg-secondary': '#2d0052',
    '--bg-tertiary': '#420073',
    '--text-primary': '#00ffff',
    '--text-secondary': '#ff69b4',
    '--border-color': '#9d00ff',
    '--border-light': '#d000ff',
    '--accent-primary': '#ff00ff',
    '--accent-secondary': '#ff0080',
    '--face-bg': '#330066',
    '--face-border': '#6600cc',
    '--scroll-thumb': '#9d00ff',
    '--scroll-track': '#420073'
  }
};

export const FACE_EMOTIONS_CORE = {
  normal: 'just-be.mp4',
  thinking: 'thinking.mp4',
  waveform: 'waveform.mp4',
};

export const FACE_EMOTIONS_CONVERSATION = [
  'talk-with-eyes-1.mp4', 'talk-with-eyes-2.mp4', 'talk-with-eyes-3.mp4',
  'talk-with-eyes-4.mp4', 'talk-with-eyes-5.mp4', 'talk-with-eyes-6.mp4',
  'talk-with-eyes-7.mp4', 'talk-with-eyes-8.mp4', 'talk-with-eyes-9.mp4',
  'talk-with-eyes-10.mp4', 'talk-with-eyes-11.mp4', 'talk-with-eyes-12.mp4',
  'talk-with-eyes-13.mp4', 'talk-with-eyes-14.mp4', 'talk-with-eyes-15.mp4',
  'talk-with-eyes-16.mp4', 'talk-with-eyes-17.mp4', 'talk-with-eyes-18.mp4',
  'talk-with-eyes-19.mp4', 'talk-with-eyes-20.mp4'
];

export const FACE_EMOTIONS_SLEEPY = [
  'yawn.mp4', 'sleep.mp4', 'sleepy.mp4', 'sleepy-peek.mp4'
];

export const FACE_EMOTIONS_BORED = [
  'newspaper-0069.mp4', 'happy-sparkles.mp4', 'conversation-respond.mp4', 'meditate.mp4',
  'conversation-respond.mp4', 'focused-typing-0075.mp4', 'd-oh.mp4', 'sigh.mp4',
  'laugh.mp4', 'giggle.mp4', 'dizzy.mp4'
];

export const FACE_EMOTIONS = {
  happy: {
    low: ['left-wink.mp4', 'right-wink.mp4'],
    med: ['happy-sparkles.mp4', 'giggle.mp4'],
    high: ['bliss.mp4', 'laugh.mp4', 'belly-laugh.mp4']
  },
  sad: {
    low: ['sad-2.mp4', 'sad-3.mp4', 'look-down.mp4'],
    med: ['sad.mp4', 'crying.mp4'],
    high: ['sad.mp4']
  },
  excited: {
    low: ['happy-sparkles.mp4'],
    med: ['laugh.mp4', 'giggle.mp4', 'yes.mp4'],
    high: ['bliss.mp4']
  },
  confused: {
    low: ['question.mp4', 'small-question.mp4', 'tilt-question.mp4'],
    med: ['maybe-left.mp4', 'maybe-right.mp4'],
    high: ['dizzy.mp4']
  },
  angry: {
    low: ['frustrated.mp4', 'side-eye.mp4', 'meditate.mp4'],
    med: ['frustrated.mp4', 'angry.mp4', 'glare.mp4', 'glare-2.mp4', 'glare-3.mp4'],
    high: ['angry.mp4', 'fire-eyes.mp4']
  },
  embarrassed: {
    low: ['embarrased-2.mp4', 'embarrassed-3.mp4'],
    med: ['embarrassed.mp4', 'sigh.mp4'],
    high: ['d-oh.mp4']
  },
  surprise: {
    low: ['question.mp4', 'small-question.mp4', 'what.mp4'],
    med: ['surprise.mp4', 'shocked-into-silence.mp4', 'big-what.mp4'],
    high: ['shocked-into-silence.mp4', 'surprise-2.mp4']
  },
  researching: {
    low: ['conversation-respond.mp4', 'newspaper-0069.mp4'],
    med: ['ai.mp4', 'focused-typing-0075.mp4'],
    high: ['ai-scan.mp4']
  },
  alerted: {
    low: ['alarm.mp4', 'question.mp4', 'what.mp4'],
    med: ['alarm.mp4'],
    high: ['high-alerted.mp4', 'shocked-into-silence.mp4', 'scared.mp4']
  },
  agree: {
    low: ['maybe-left.mp4', 'maybe-right.mp4'],
    med: ['yes.mp4'],
    high: ['yes.mp4']
  },
  disagree: {
    low: ['maybe-left.mp4', 'maybe-right.mp4', 'sigh.mp4'],
    med: ['no.mp4'],
    high: ['no.mp4', 'big-no.mp4']
  }
};

export const INACTIVITY_THRESHOLDS = {
  bored: 5 * 60 * 1000,
  sleepy: 30 * 60 * 1000,
  sleep: 60 * 60 * 1000
};

export const EDGE_TTS_URL = 'https://haneldev.zapto.org/edge-tts/';

export const RUCKUS_GIST_ID = 'd7ad2f9aaa3edc9c42fc3e8a744bb27e';

export const EMOTION_SPEECH_SETTINGS = {
  normal:      { rate: 1.00, pitch: 1.00 },
  happy:       { rate: 1.05, pitch: 1.15 },
  sad:         { rate: 0.90, pitch: 0.85 },
  excited:     { rate: 1.20, pitch: 1.25 },
  confused:    { rate: 0.95, pitch: 1.05 },
  angry:       { rate: 1.10, pitch: 0.90 },
  embarrassed: { rate: 0.95, pitch: 1.10 },
  surprise:    { rate: 1.15, pitch: 1.20 },
  researching: { rate: 0.95, pitch: 0.95 },
  alerted:     { rate: 1.15, pitch: 1.10 },
  agree:       { rate: 1.00, pitch: 1.05 },
  disagree:    { rate: 1.00, pitch: 0.95 }
};

export const TIME_GAP_MENTION_THRESHOLD = 2 * 60 * 60 * 1000;

export const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/jerryhanel/ruckus-faces/main/';
