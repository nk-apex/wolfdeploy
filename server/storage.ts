import { type Bot, type Deployment, type DeploymentStatus } from "@shared/schema";
import { randomUUID } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface IStorage {
  getBots(): Promise<Bot[]>;
  getBot(id: string): Promise<Bot | undefined>;
  getDeployments(): Promise<Deployment[]>;
  getDeployment(id: string): Promise<Deployment | undefined>;
  createDeployment(botId: string, botName: string, botRepo: string, envVars: Record<string, string>): Promise<Deployment>;
  updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<Deployment | undefined>;
  addDeploymentLog(id: string, level: "info" | "warn" | "error" | "success", message: string): Promise<void>;
  stopDeployment(id: string): Promise<Deployment | undefined>;
  deleteDeployment(id: string): Promise<boolean>;
}

const BOTS: Bot[] = [
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
        description: "Your WhatsApp phone number with country code (e.g. +254712345678)",
        required: true,
        placeholder: "+254712345678",
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
        description: "Your WhatsApp phone number with country code (e.g. +254712345678)",
        required: true,
        placeholder: "+254712345678",
      },
    },
  },
];

const BASE_DIR = join(tmpdir(), "botforge-deployments");

class MemStorage implements IStorage {
  private bots: Map<string, Bot>;
  private deployments: Map<string, Deployment>;
  private processes: Map<string, ChildProcess>;

  constructor() {
    this.bots = new Map(BOTS.map(b => [b.id, b]));
    this.deployments = new Map();
    this.processes = new Map();
    mkdirSync(BASE_DIR, { recursive: true });
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

  async createDeployment(
    botId: string,
    botName: string,
    botRepo: string,
    envVars: Record<string, string>
  ): Promise<Deployment> {
    const id = randomUUID();
    const deployDir = join(BASE_DIR, id);

    const deployment: Deployment = {
      id,
      botId,
      botName,
      status: "queued",
      envVars,
      url: undefined,
      port: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [],
      metrics: { cpu: 0, memory: 0, uptime: 0, requests: 0 },
    };
    this.deployments.set(id, deployment);

    // Run deployment pipeline in background (non-blocking)
    this.runDeployment(id, botRepo, deployDir, envVars).catch(async (err) => {
      await this.addDeploymentLog(id, "error", `Fatal: ${err.message}`);
      await this.updateDeploymentStatus(id, "failed");
    });

    return deployment;
  }

  private async runDeployment(
    id: string,
    repoUrl: string,
    deployDir: string,
    envVars: Record<string, string>
  ): Promise<void> {
    await this.updateDeploymentStatus(id, "deploying");

    // ── Step 1: git clone ─────────────────────────────────────────────────────
    await this.addDeploymentLog(id, "info", `Cloning repository: ${repoUrl}`);
    await this.spawnStep(id, "git", ["clone", "--depth=1", repoUrl, deployDir], {});
    await this.addDeploymentLog(id, "info", "Repository cloned successfully.");

    // ── Step 2: npm install ───────────────────────────────────────────────────
    await this.addDeploymentLog(id, "info", "Installing Node.js dependencies...");
    await this.spawnStep(id, "npm", ["install", "--legacy-peer-deps", "--no-audit", "--prefer-offline"], { cwd: deployDir });
    await this.addDeploymentLog(id, "info", "Dependencies installed.");

    // ── Step 3: set env vars and start the bot ────────────────────────────────
    await this.addDeploymentLog(id, "info", "Setting environment variables...");
    await this.addDeploymentLog(id, "info", "Starting bot process...");

    const botEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...envVars,
      NODE_ENV: "production",
    };

    const botProcess = spawn("node", ["index.js"], {
      cwd: deployDir,
      env: botEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.processes.set(id, botProcess);
    await this.updateDeploymentStatus(id, "running");

    const dep = this.deployments.get(id);
    if (dep) {
      dep.metrics = { cpu: 0, memory: 0, uptime: 0, requests: 0 };
      this.deployments.set(id, dep);
    }

    await this.addDeploymentLog(id, "success", `Bot process started (PID: ${botProcess.pid})`);

    // Pipe real stdout → info logs
    botProcess.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(l => l.trim());
      for (const line of lines) {
        this.addDeploymentLog(id, "info", line.trim());
      }
    });

    // Pipe real stderr → warn/error logs
    botProcess.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(l => l.trim());
      for (const line of lines) {
        const lower = line.toLowerCase();
        const level = lower.includes("error") || lower.includes("fatal") ? "error" : "warn";
        this.addDeploymentLog(id, level, line.trim());
      }
    });

    // Handle process exit
    botProcess.on("exit", (code, signal) => {
      this.processes.delete(id);
      const dep = this.deployments.get(id);
      if (!dep || dep.status === "stopped") return;
      if (code === 0) {
        this.addDeploymentLog(id, "info", `Process exited cleanly (code 0).`);
        this.updateDeploymentStatus(id, "stopped");
      } else {
        this.addDeploymentLog(id, "error", `Process exited with code ${code ?? signal}. Bot crashed.`);
        this.updateDeploymentStatus(id, "failed");
      }
    });

    botProcess.on("error", (err) => {
      this.addDeploymentLog(id, "error", `Process error: ${err.message}`);
      this.updateDeploymentStatus(id, "failed");
    });
  }

  /**
   * Spawn a subprocess, pipe its output to deployment logs, and wait for it to finish.
   * Rejects if the exit code is non-zero.
   */
  private spawnStep(
    id: string,
    cmd: string,
    args: string[],
    opts: { cwd?: string }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd: opts.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

      proc.stdout?.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n").filter(l => l.trim());
        for (const line of lines) this.addDeploymentLog(id, "info", line.trim());
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n").filter(l => l.trim());
        for (const line of lines) this.addDeploymentLog(id, "warn", line.trim());
      });

      proc.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${cmd} exited with code ${code}`));
      });

      proc.on("error", reject);
    });
  }

  async updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<Deployment | undefined> {
    const dep = this.deployments.get(id);
    if (!dep) return undefined;
    dep.status = status;
    dep.updatedAt = new Date().toISOString();
    this.deployments.set(id, dep);
    return dep;
  }

  async addDeploymentLog(
    id: string,
    level: "info" | "warn" | "error" | "success",
    message: string
  ): Promise<void> {
    const dep = this.deployments.get(id);
    if (!dep) return;
    // Truncate to last 500 log lines to avoid memory bloat
    if (dep.logs.length >= 500) dep.logs.shift();
    dep.logs.push({ timestamp: new Date().toISOString(), level, message });
    dep.updatedAt = new Date().toISOString();
    this.deployments.set(id, dep);
  }

  async stopDeployment(id: string): Promise<Deployment | undefined> {
    const proc = this.processes.get(id);
    if (proc && !proc.killed) {
      await this.addDeploymentLog(id, "warn", "Received stop signal. Sending SIGTERM to bot process...");
      proc.kill("SIGTERM");
      setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
      this.processes.delete(id);
    } else {
      await this.addDeploymentLog(id, "warn", "No running process found for this deployment.");
    }
    await this.addDeploymentLog(id, "info", "Bot stopped.");
    return this.updateDeploymentStatus(id, "stopped");
  }

  async deleteDeployment(id: string): Promise<boolean> {
    // Kill any running process
    const proc = this.processes.get(id);
    if (proc && !proc.killed) {
      proc.kill("SIGKILL");
      this.processes.delete(id);
    }
    // Remove deploy directory
    const deployDir = join(BASE_DIR, id);
    if (existsSync(deployDir)) {
      try { rmSync(deployDir, { recursive: true, force: true }); } catch (_) {}
    }
    return this.deployments.delete(id);
  }
}

export const storage = new MemStorage();
