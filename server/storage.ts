import { type Bot, type Deployment, type DeploymentStatus } from "@shared/schema";
import { randomUUID } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync, unlinkSync, symlinkSync } from "fs";
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
    logo: "https://avatars.githubusercontent.com/u/256216610?v=4",
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
  {
    id: "davex",
    name: "DAVE-X",
    description: "Dave Tech bot — a friendly, feature-packed WhatsApp assistant built by Gifted Dave. Supports media, group management, auto-reply, and more. Hostable on any platform.",
    repository: "https://github.com/Davex-254/DAVE-X.git",
    logo: "https://avatars.githubusercontent.com/u/217832615?v=4",
    keywords: ["whatsapp", "bot", "dave-x", "baileys", "nodejs"],
    category: "WhatsApp Bot",
    stars: 56,
    env: {
      SESSION_ID: {
        description: "Your session ID. Must begin with 'DAVE-AI:~'",
        required: true,
        placeholder: "DAVE-AI:~xxxxxxxxxxxx",
      },
      PHONE_NUMBER: {
        description: "Your WhatsApp phone number with country code (e.g. +254712345678)",
        required: true,
        placeholder: "+254712345678",
      },
    },
  },
  {
    id: "truthmd",
    name: "TRUTH-MD",
    description: "TRUTH-MD — a powerful multi-device WhatsApp bot with rich features including media, games, group management, auto-reply, and much more. Built on Baileys.",
    repository: "https://github.com/Courtney250/TRUTH-MD.git",
    logo: "https://avatars.githubusercontent.com/Courtney250",
    keywords: ["whatsapp", "bot", "truth-md", "baileys", "multi-device"],
    category: "WhatsApp Bot",
    stars: 0,
    env: {
      SESSION_ID: {
        description: "Your session ID for TRUTH-MD",
        required: true,
        placeholder: "TRUTH-MD_xxxxxxxxxxxx",
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

    // ── Step 2b: expose node_modules to /tmp so downloaded plugins find them ──
    // Bots like WolfBot download plugins (n7-main) into /tmp/.xxx/ and import
    // packages like dotenv from there. Node.js traverses up to /tmp/node_modules
    // during resolution, so we symlink there to make the bot's deps available.
    try {
      const tmpNodeModules = "/tmp/node_modules";
      const botNodeModules = join(deployDir, "node_modules");
      try { unlinkSync(tmpNodeModules); } catch { /* ok if not a symlink */ }
      try { rmSync(tmpNodeModules, { recursive: true, force: true }); } catch { /* ok */ }
      symlinkSync(botNodeModules, tmpNodeModules);
    } catch (e) {
      await this.addDeploymentLog(id, "warn", `Could not create /tmp/node_modules symlink: ${e}`);
    }

    // ── Step 3: write .env file + build process env ───────────────────────────
    await this.addDeploymentLog(id, "info", "Setting environment variables...");

    // Automatically inject the Supabase PostgreSQL database
    const platformDb = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
    // Assign a random high port so bots don't conflict with WolfDeploy's port 5000.
    // Bots like WolfBot spin up a health-check HTTP server using process.env.PORT.
    const botPort = String(10000 + Math.floor(Math.random() * 50000));

    const fullEnv: Record<string, string> = {
      ...envVars,
      NODE_ENV: "production",
      PORT: botPort,
    };
    if (platformDb) {
      fullEnv.DATABASE_URL = platformDb;
      await this.addDeploymentLog(id, "info", "Database: Supabase PostgreSQL provisioned automatically.");
    } else {
      await this.addDeploymentLog(id, "warn", "DATABASE_URL not found on platform — bot may fail if it needs a database.");
    }

    // Write a real .env file so dotenv picks everything up too
    const quote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const envFileContent = Object.entries(fullEnv)
      .map(([k, v]) => `${k}=${quote(v)}`)
      .join("\n") + "\n";
    writeFileSync(join(deployDir, ".env"), envFileContent, "utf-8");
    await this.addDeploymentLog(id, "info", `Environment ready (${Object.keys(fullEnv).length} variables).`);
    await this.addDeploymentLog(id, "info", "Starting bot process...");

    const botEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...fullEnv,
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

    // Pipe real stderr → warn/error logs (single handler, accumulated for flush)
    let stderrBuf = "";
    botProcess.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      // Keep last incomplete line in buffer
      stderrBuf = lines.pop() ?? "";
      for (const line of lines.filter(l => l.trim())) {
        const lower = line.toLowerCase();
        const level = lower.includes("error") || lower.includes("fatal") ? "error" : "warn";
        this.addDeploymentLog(id, level, line.trim());
      }
    });

    // Handle process exit — wait 600ms for any remaining stdio data to flush through
    botProcess.on("exit", (code, signal) => {
      this.processes.delete(id);
      setTimeout(async () => {
        // Flush any remaining buffered stderr
        if (stderrBuf.trim()) {
          const lower = stderrBuf.toLowerCase();
          const level = lower.includes("error") || lower.includes("fatal") ? "error" : "warn";
          await this.addDeploymentLog(id, level, stderrBuf.trim());
        }
        const dep = this.deployments.get(id);
        if (!dep || dep.status === "stopped") return;
        if (code === 0) {
          await this.addDeploymentLog(id, "info", `Process exited cleanly (code 0).`);
          await this.updateDeploymentStatus(id, "stopped");
        } else {
          await this.addDeploymentLog(id, "error", `Process exited with code ${code ?? signal}. Bot crashed.`);
          await this.updateDeploymentStatus(id, "failed");
        }
      }, 600);
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
