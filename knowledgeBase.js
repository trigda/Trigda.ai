// Approved TRIGDA knowledge base. The chatbot must only answer from this
// content (or hand off to a human) - it must never invent business facts,
// pricing, or promises that aren't written here.

const KNOWLEDGE_BASE = [
  {
    id: 'about',
    keywords: ['about', 'trigda', 'who', 'company', 'what is trigda'],
    topic: 'About TRIGDA',
    answer:
      "TRIGDA is a technology and automation partner based in Gujranwala, Pakistan, founded by Talha Bin Saeed. TRIGDA builds modern business websites, runs lead generation campaigns, and develops AI chatbots and automation systems that cut down repetitive manual work.",
  },
  {
    id: 'services-overview',
    keywords: ['services', 'offer', 'what do you do', 'help with'],
    topic: 'Services overview',
    answer:
      "TRIGDA offers three core services: Website Development (responsive, modern business websites), Lead Generation (targeted prospecting and data collection for B2B/B2C), and AI Chatbot & Automation (chatbots and workflow automation for customer communication and repetitive tasks). Open the Services page for full details on each.",
  },
  {
    id: 'website-dev',
    keywords: ['website', 'web development', 'web design', 'site'],
    topic: 'Website Development',
    answer:
      "TRIGDA designs and builds responsive, modern websites for businesses, personal brands, and service providers - covering clean UX, mobile responsiveness, forms, integrations, and deployment.",
  },
  {
    id: 'lead-gen',
    keywords: ['lead generation', 'leads', 'prospecting', 'b2b', 'b2c'],
    topic: 'Lead Generation',
    answer:
      "TRIGDA's lead generation service covers research and prospecting support, with a focus on accurate targeting, data quality, segmentation, and delivery according to the scope agreed with each client.",
  },
  {
    id: 'chatbot-automation',
    keywords: ['chatbot', 'automation', 'ai bot', 'workflow'],
    topic: 'AI Chatbot & Automation',
    answer:
      "TRIGDA builds business chatbots and automation systems that answer FAQs, route inquiries, collect information, book appointments, and reduce repetitive manual work for a business.",
  },
  {
    id: 'process',
    keywords: ['process', 'how does it work', 'steps', 'workflow steps'],
    topic: 'Working process',
    answer:
      "TRIGDA follows five steps on every project: understand the requirement, plan the solution, build/configure it, test it thoroughly, then launch and support it.",
  },
  {
    id: 'pricing',
    keywords: ['price', 'pricing', 'cost', 'how much', 'charges', 'fee', 'budget'],
    topic: 'Pricing',
    answer:
      "Pricing depends on project scope, so it isn't listed publicly. Please book a free consultation and we'll discuss a quote tailored to your project.",
  },
  {
    id: 'booking',
    keywords: ['book', 'appointment', 'schedule', 'consultation', 'meeting', 'call'],
    topic: 'Appointment booking',
    answer:
      "You can schedule a consultation from the Appointment page - just enter your name, email, phone, company, the service you're interested in, and a preferred date and time. You'll get an on-screen confirmation right after booking.",
  },
  {
    id: 'contact',
    keywords: ['contact', 'phone', 'email', 'reach', 'location', 'address', 'talha'],
    topic: 'Contact details',
    answer:
      "You can reach TRIGDA at talhabinsaeed36@gmail.com or +92 312 6154283. TRIGDA is based in Gujranwala, Pakistan. The fastest way to start a project is to book a consultation from the Appointment page.",
  },
  {
    id: 'chatbot-limits',
    keywords: ['message limit', 'how many messages', 'chat limit', 'reset'],
    topic: 'Chatbot usage limit',
    answer:
      "This chat allows up to 10 messages per visitor in a rolling 24-hour window, after which it resets automatically. For anything urgent, please book a consultation or contact TRIGDA directly.",
  },
];

function findAnswer(userMessage) {
  const text = userMessage.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (text.includes(kw)) score += kw.split(' ').length; // multi-word keyword matches score higher
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore > 0 ? best : null;
}

const FALLBACK_ANSWER =
  "I'm not certain about that. Please book a consultation or contact Talha directly at talhabinsaeed36@gmail.com so a human can help with the specifics.";

module.exports = { KNOWLEDGE_BASE, findAnswer, FALLBACK_ANSWER };
