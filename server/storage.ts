import { type Bot, type Deployment, type DeploymentStatus, platformBots } from "@shared/schema";
import { randomUUID } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync, unlinkSync, symlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getBots(): Promise<Bot[]>;
  getBot(id: string): Promise<Bot | undefined>;
  getAllDeployments(): Promise<Deployment[]>;
  getDeployments(): Promise<Deployment[]>;
  getDeployment(id: string): Promise<Deployment | undefined>;
  createDeployment(botId: string, botName: string, botRepo: string, envVars: Record<string, string>, userId?: string): Promise<Deployment>;
  updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<Deployment | undefined>;
  addDeploymentLog(id: string, level: "info" | "warn" | "error" | "success", message: string): Promise<void>;
  stopDeployment(id: string): Promise<Deployment | undefined>;
  deleteDeployment(id: string): Promise<boolean>;
}

const BASE_DIR = join(tmpdir(), "botforge-deployments");

class MemStorage implements IStorage {
  private deployments: Map<string, Deployment>;
  private processes: Map<string, ChildProcess>;

  constructor() {
    this.deployments = new Map();
    this.processes = new Map();
    mkdirSync(BASE_DIR, { recursive: true });
  }

  async getBots(): Promise<Bot[]> {
    const rows = await db.select().from(platformBots);
    return rows
      .filter(r => r.active)
      .map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        repository: r.repository,
        logo: r.logo ?? undefined,
        keywords: r.keywords,
        category: r.category ?? "WhatsApp Bot",
        stars: r.stars ?? 0,
        env: (r.env as Bot["env"]) ?? {},
        active: r.active ?? true,
      }));
  }

  async getBot(id: string): Promise<Bot | undefined> {
    const rows = await db.select().from(platformBots).where(
      eq(platformBots.id, id)
    );
    if (!rows[0]) return undefined;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      repository: r.repository,
      logo: r.logo ?? undefined,
      keywords: r.keywords,
      category: r.category ?? "WhatsApp Bot",
      stars: r.stars ?? 0,
      env: (r.env as Bot["env"]) ?? {},
      active: r.active ?? true,
    };
  }

  async getAllDeployments(): Promise<Deployment[]> {
    return Array.from(this.deployments.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
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
    envVars: Record<string, string>,
    userId?: string
  ): Promise<Deployment> {
    const id = randomUUID();
    const deployDir = join(BASE_DIR, id);

    const deployment: Deployment = {
      id,
      botId,
      botName,
      userId,
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

    await this.addDeploymentLog(id, "info", `Cloning repository: ${repoUrl}`);
    await this.spawnStep(id, "git", ["clone", "--depth=1", repoUrl, deployDir], {});
    await this.addDeploymentLog(id, "info", "Repository cloned successfully.");

    await this.addDeploymentLog(id, "info", "Installing Node.js dependencies...");
    await this.spawnStep(id, "npm", ["install", "--legacy-peer-deps", "--no-audit", "--prefer-offline"], { cwd: deployDir });
    await this.addDeploymentLog(id, "info", "Dependencies installed.");

    try {
      const tmpNodeModules = "/tmp/node_modules";
      const botNodeModules = join(deployDir, "node_modules");
      try { unlinkSync(tmpNodeModules); } catch { /* ok */ }
      try { rmSync(tmpNodeModules, { recursive: true, force: true }); } catch { /* ok */ }
      symlinkSync(botNodeModules, tmpNodeModules);
    } catch (e) {
      await this.addDeploymentLog(id, "warn", `Could not create /tmp/node_modules symlink: ${e}`);
    }

    await this.addDeploymentLog(id, "info", "Setting environment variables...");

    const platformDb = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
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

    const quote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const envFileContent = Object.entries(fullEnv)
      .map(([k, v]) => `${k}=${quote(v)}`)
      .join("\n") + "\n";
    writeFileSync(join(deployDir, ".env"), envFileContent, "utf-8");
    await this.addDeploymentLog(id, "info", `Environment ready (${Object.keys(fullEnv).length} variables).`);
    await this.addDeploymentLog(id, "info", "Starting bot process...");

    const botEnv: NodeJS.ProcessEnv = { ...process.env, ...fullEnv };

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

    botProcess.stdout?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(l => l.trim());
      for (const line of lines) this.addDeploymentLog(id, "info", line.trim());
    });

    let stderrBuf = "";
    botProcess.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() ?? "";
      for (const line of lines.filter(l => l.trim())) {
        const lower = line.toLowerCase();
        const level = lower.includes("error") || lower.includes("fatal") ? "error" : "warn";
        this.addDeploymentLog(id, level, line.trim());
      }
    });

    botProcess.on("exit", (code, signal) => {
      this.processes.delete(id);
      setTimeout(async () => {
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
    const proc = this.processes.get(id);
    if (proc && !proc.killed) {
      proc.kill("SIGKILL");
      this.processes.delete(id);
    }
    const deployDir = join(BASE_DIR, id);
    if (existsSync(deployDir)) {
      try { rmSync(deployDir, { recursive: true, force: true }); } catch (_) {}
    }
    return this.deployments.delete(id);
  }
}

export const storage = new MemStorage();
