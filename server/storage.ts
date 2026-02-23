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
    id: "silentwolf",
    name: "Silent WolfBot",
    description: "Professional WhatsApp Bot with auto-session authentication. Powered by Baileys with support for media, commands, auto-reply and more.",
    repository: "https://github.com/7silent-wolf/silentwolf.git",
    logo: "https://raw.githubusercontent.com/SuhailTechInfo/Suhail-Md/main/src/logo.jpg",
    keywords: ["whatsapp", "bot", "wolfbot", "baileys", "session"],
    category: "WhatsApp Bot",
    stars: 0,
    env: {
      SESSION_ID: {
        description: "Your session ID. Must begin with 'WOLF-BOT'",
        required: true,
        placeholder: "WOLF-BOT_xxxxxxxxxxxx",
      },
      PHONE_NUMBER: {
        description: "Your WhatsApp phone number with country code (e.g. +1234567890)",
        required: true,
        placeholder: "+1234567890",
      },
    },
  },
  {
    id: "junex",
    name: "JUNE-X",
    description: "June-x, your friendly WhatsApp assistant! Feature-rich bot with media support, auto-reply, games, and more. Built on Baileys with container stack.",
    repository: "https://github.com/Vinpink2/JUNE-X.git",
    logo: "https://avatars.githubusercontent.com/u/166421298?v=4",
    keywords: ["whatsapp", "bot", "june-x", "baileys", "assistant"],
    category: "WhatsApp Bot",
    stars: 0,
    env: {
      SESSION_ID: {
        description: "Your session ID. Must begin with 'JUNE-MD:~'",
        required: true,
        placeholder: "JUNE-MD:~xxxxxxxxxxxx",
      },
      PHONE_NUMBER: {
        description: "Your WhatsApp phone number with country code (e.g. +1234567890)",
        required: true,
        placeholder: "+1234567890",
      },
    },
  },
];

const DEPLOY_LOG_SEQUENCE = [
  "Cloning repository from GitHub...",
  "Repository cloned successfully.",
  "Installing Node.js dependencies (npm install)...",
  "Dependencies installed.",
  "Setting environment variables...",
  "Building Docker image...",
  "Docker image built successfully.",
  "Starting container on port {PORT}...",
  "Running health checks...",
  "Health checks passed.",
  "Bot is online and ready to receive WhatsApp messages",
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
    await this.sleep(600);
    await this.updateDeploymentStatus(id, "deploying");

    for (let i = 0; i < DEPLOY_LOG_SEQUENCE.length; i++) {
      await this.sleep(700 + Math.random() * 800);
      const msg = DEPLOY_LOG_SEQUENCE[i].replace("{PORT}", String(port));
      const isLast = i === DEPLOY_LOG_SEQUENCE.length - 1;
      await this.addDeploymentLog(id, isLast ? "success" : "info", msg);
    }

    await this.updateDeploymentStatus(id, "running");
    const dep = this.deployments.get(id);
    if (dep) {
      dep.metrics = {
        cpu: 0.3 + Math.random() * 2.5,
        memory: 90 + Math.random() * 80,
        uptime: 0,
        requests: 0,
      };
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
    await this.sleep(400);
    await this.addDeploymentLog(id, "info", "Container stopped successfully.");
    return this.updateDeploymentStatus(id, "stopped");
  }

  async deleteDeployment(id: string): Promise<boolean> {
    return this.deployments.delete(id);
  }
}

export const storage = new MemStorage();
