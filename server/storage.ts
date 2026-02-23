import { type Bot, type Deployment, type DeploymentStatus } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getBots(): Promise<Bot[]>;
  getBot(id: string): Promise<Bot | undefined>;
  getDeployments(): Promise<Deployment[]>;
  getDeployment(id: string): Promise<Deployment | undefined>;
  createDeployment(botId: string, botName: string, envVars: Record<string, string>): Promise<Deployment>;
  updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<Deployment | undefined>;
  addDeploymentLog(id: string, level: "info" | "warn" | "error" | "success", message: string): Promise<void>;
  stopDeployment(id: string): Promise<Deployment | undefined>;
  deleteDeployment(id: string): Promise<boolean>;
}

const AVAILABLE_BOTS: Bot[] = [
  {
    id: "whatsapp-assistant",
    name: "WhatsApp Assistant",
    description: "A smart WhatsApp bot that answers questions, sets reminders and helps manage your daily tasks",
    repository: "https://github.com/botforge/whatsapp-assistant",
    keywords: ["assistant", "productivity", "ai"],
    category: "Productivity",
    stars: 1247,
    env: {
      SESSION_ID: { description: "WhatsApp session ID for authentication", required: true, placeholder: "whatsapp_session_xxxxx" },
      PHONE_NUMBER: { description: "Your WhatsApp phone number with country code", required: true, placeholder: "+1234567890" },
      OPENAI_API_KEY: { description: "OpenAI API key for AI responses", required: false, placeholder: "sk-..." },
    },
  },
  {
    id: "group-manager",
    name: "Group Manager Bot",
    description: "Automate WhatsApp group management — welcome messages, spam filtering, anti-link, and member controls",
    repository: "https://github.com/botforge/group-manager",
    keywords: ["groups", "moderation", "management"],
    category: "Management",
    stars: 892,
    env: {
      SESSION_ID: { description: "WhatsApp session ID for authentication", required: true, placeholder: "whatsapp_session_xxxxx" },
      PHONE_NUMBER: { description: "Your WhatsApp phone number with country code", required: true, placeholder: "+1234567890" },
      ADMIN_NUMBER: { description: "Admin phone number for alerts", required: false, placeholder: "+1234567890" },
    },
  },
  {
    id: "ecommerce-bot",
    name: "eCommerce Sales Bot",
    description: "Turn WhatsApp into a sales channel — product catalog, order management, payment links and customer support",
    repository: "https://github.com/botforge/ecommerce-bot",
    keywords: ["ecommerce", "sales", "payments"],
    category: "Business",
    stars: 2103,
    env: {
      SESSION_ID: { description: "WhatsApp session ID for authentication", required: true, placeholder: "whatsapp_session_xxxxx" },
      PHONE_NUMBER: { description: "Your WhatsApp phone number with country code", required: true, placeholder: "+1234567890" },
      STORE_NAME: { description: "Your store or business name", required: true, placeholder: "My Shop" },
      CURRENCY: { description: "Currency code (USD, KES, NGN, etc)", required: false, placeholder: "USD" },
    },
  },
  {
    id: "news-bot",
    name: "News & Alerts Bot",
    description: "Subscribe contacts to news feeds, sports scores, weather updates and custom alerts delivered to WhatsApp",
    repository: "https://github.com/botforge/news-bot",
    keywords: ["news", "alerts", "notifications"],
    category: "Notifications",
    stars: 654,
    env: {
      SESSION_ID: { description: "WhatsApp session ID for authentication", required: true, placeholder: "whatsapp_session_xxxxx" },
      PHONE_NUMBER: { description: "Your WhatsApp phone number with country code", required: true, placeholder: "+1234567890" },
      NEWS_API_KEY: { description: "NewsAPI.org API key", required: false, placeholder: "your_newsapi_key" },
    },
  },
  {
    id: "crypto-tracker",
    name: "Crypto Price Tracker",
    description: "Track crypto prices, set price alerts and get portfolio updates directly in WhatsApp",
    repository: "https://github.com/botforge/crypto-tracker",
    keywords: ["crypto", "finance", "alerts"],
    category: "Finance",
    stars: 1876,
    env: {
      SESSION_ID: { description: "WhatsApp session ID for authentication", required: true, placeholder: "whatsapp_session_xxxxx" },
      PHONE_NUMBER: { description: "Your WhatsApp phone number with country code", required: true, placeholder: "+1234567890" },
      COINGECKO_API_KEY: { description: "CoinGecko API key (optional for higher rate limits)", required: false, placeholder: "CG-..." },
    },
  },
  {
    id: "customer-support",
    name: "Customer Support Bot",
    description: "AI-powered customer support bot with ticket routing, FAQ answering and live agent handoff via WhatsApp",
    repository: "https://github.com/botforge/customer-support",
    keywords: ["support", "helpdesk", "ai"],
    category: "Business",
    stars: 3241,
    env: {
      SESSION_ID: { description: "WhatsApp session ID for authentication", required: true, placeholder: "whatsapp_session_xxxxx" },
      PHONE_NUMBER: { description: "Your WhatsApp phone number with country code", required: true, placeholder: "+1234567890" },
      SUPPORT_EMAIL: { description: "Email for ticket escalations", required: true, placeholder: "support@company.com" },
      BUSINESS_NAME: { description: "Your business name", required: true, placeholder: "Acme Corp" },
    },
  },
];

const DEPLOY_LOG_SEQUENCES: string[][] = [
  [
    "Initializing deployment pipeline...",
    "Pulling repository from GitHub...",
    "Installing Node.js dependencies...",
    "Building Docker image...",
    "Configuring environment variables...",
    "Starting container on port {PORT}...",
    "Running health checks...",
    "Bot is online and ready to receive messages",
  ],
];

class MemStorage implements IStorage {
  private bots: Map<string, Bot>;
  private deployments: Map<string, Deployment>;

  constructor() {
    this.bots = new Map(AVAILABLE_BOTS.map(b => [b.id, b]));
    this.deployments = new Map();
  }

  async getBots(): Promise<Bot[]> {
    return Array.from(this.bots.values());
  }

  async getBot(id: string): Promise<Bot | undefined> {
    return this.bots.get(id);
  }

  async getDeployments(): Promise<Deployment[]> {
    return Array.from(this.deployments.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getDeployment(id: string): Promise<Deployment | undefined> {
    return this.deployments.get(id);
  }

  async createDeployment(botId: string, botName: string, envVars: Record<string, string>): Promise<Deployment> {
    const id = randomUUID();
    const port = 3100 + Math.floor(Math.random() * 900);
    const deployment: Deployment = {
      id,
      botId,
      botName,
      status: "queued",
      envVars,
      url: `https://${botId}-${id.slice(0, 8)}.botforge.app`,
      port,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [],
      metrics: { cpu: 0, memory: 0, uptime: 0, requests: 0 },
    };
    this.deployments.set(id, deployment);
    this.simulateDeploy(id, port);
    return deployment;
  }

  private async simulateDeploy(id: string, port: number) {
    const sequence = DEPLOY_LOG_SEQUENCES[0];
    await this.sleep(500);
    await this.updateDeploymentStatus(id, "deploying");

    for (let i = 0; i < sequence.length; i++) {
      await this.sleep(800 + Math.random() * 700);
      const msg = sequence[i].replace("{PORT}", String(port));
      const isLast = i === sequence.length - 1;
      await this.addDeploymentLog(id, isLast ? "success" : "info", msg);
    }

    await this.updateDeploymentStatus(id, "running");
    const dep = this.deployments.get(id);
    if (dep) {
      dep.metrics = { cpu: 0.2 + Math.random() * 2, memory: 80 + Math.random() * 60, uptime: 0, requests: 0 };
      this.deployments.set(id, dep);
    }
  }

  private sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  async updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<Deployment | undefined> {
    const dep = this.deployments.get(id);
    if (!dep) return undefined;
    dep.status = status;
    dep.updatedAt = new Date().toISOString();
    this.deployments.set(id, dep);
    return dep;
  }

  async addDeploymentLog(id: string, level: "info" | "warn" | "error" | "success", message: string): Promise<void> {
    const dep = this.deployments.get(id);
    if (!dep) return;
    dep.logs.push({ timestamp: new Date().toISOString(), level, message });
    dep.updatedAt = new Date().toISOString();
    this.deployments.set(id, dep);
  }

  async stopDeployment(id: string): Promise<Deployment | undefined> {
    await this.addDeploymentLog(id, "warn", "Received stop signal. Gracefully shutting down container...");
    await this.sleep(300);
    await this.addDeploymentLog(id, "info", "Container stopped.");
    return this.updateDeploymentStatus(id, "stopped");
  }

  async deleteDeployment(id: string): Promise<boolean> {
    return this.deployments.delete(id);
  }
}

export const storage = new MemStorage();
