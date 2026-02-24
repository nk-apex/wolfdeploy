import { type Bot, type Deployment, type DeploymentStatus, platformBots, deployments as deploymentsTable } from "@shared/schema";
import { randomUUID } from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import * as ptero from "./pterodactyl";

export interface IStorage {
  initialize(): Promise<void>;
  getBots(): Promise<Bot[]>;
  getBot(id: string): Promise<Bot | undefined>;
  getAllDeployments(): Promise<Deployment[]>;
  getDeployments(userId?: string): Promise<Deployment[]>;
  getDeployment(id: string): Promise<Deployment | undefined>;
  createDeployment(botId: string, botName: string, botRepo: string, envVars: Record<string, string>, userId?: string, plan?: "trial" | "monthly", expiresAt?: Date): Promise<Deployment>;
  updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<Deployment | undefined>;
  addDeploymentLog(id: string, level: "info" | "warn" | "error" | "success", message: string): Promise<void>;
  stopDeployment(id: string): Promise<Deployment | undefined>;
  deleteDeployment(id: string): Promise<boolean>;
}

const BASE_DIR = join(tmpdir(), "botforge-deployments");

const DEFAULT_BOTS = [
  {
    id: "wolfbot",
    name: "WolfBot",
    description: "Professional WhatsApp Bot with auto-session authentication. Powered by Baileys with support for media, commands, auto-reply and more.",
    repository: "https://github.com/7silent-wolf/silentwolf.git",
    logo: "https://avatars.githubusercontent.com/u/256216610?v=4",
    keywords: ["whatsapp", "bot", "wolfbot", "baileys", "session"],
    category: "WhatsApp Bot",
    stars: 0,
    env: {
      SESSION_ID: { required: true, description: "Your session ID. Must begin with 'WOLF-BOT'", placeholder: "WOLF-BOT_xxxxxxxxxxxx" },
      PHONE_NUMBER: { required: true, description: "Your WhatsApp phone number with country code (e.g. +254712345678)", placeholder: "+254712345678" },
    },
    active: true,
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
      SESSION_ID: { required: true, description: "Your session ID. Must begin with 'JUNE-MD:~'", placeholder: "JUNE-MD:~xxxxxxxxxxxx" },
      PHONE_NUMBER: { required: true, description: "Your WhatsApp phone number with country code (e.g. +254712345678)", placeholder: "+254712345678" },
    },
    active: true,
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
      SESSION_ID: { required: true, description: "Your session ID. Must begin with 'DAVE-AI:~'", placeholder: "DAVE-AI:~xxxxxxxxxxxx" },
      PHONE_NUMBER: { required: true, description: "Your WhatsApp phone number with country code (e.g. +254712345678)", placeholder: "+254712345678" },
    },
    active: true,
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
      SESSION_ID: { required: true, description: "Your session ID for TRUTH-MD", placeholder: "TRUTH-MD_xxxxxxxxxxxx" },
      PHONE_NUMBER: { required: true, description: "Your WhatsApp phone number with country code (e.g. +254712345678)", placeholder: "+254712345678" },
    },
    active: true,
  },
];

class MemStorage implements IStorage {
  private deployments: Map<string, Deployment>;
  private processes: Map<string, ChildProcess>;
  private logFlushTimers: Map<string, NodeJS.Timeout>;

  constructor() {
    this.deployments = new Map();
    this.processes = new Map();
    this.logFlushTimers = new Map();
    mkdirSync(BASE_DIR, { recursive: true });
  }

  async initialize(): Promise<void> {
    try {
      const rows = await db.select().from(deploymentsTable)
        .orderBy(desc(deploymentsTable.createdAt));

      for (const row of rows) {
        const dep: Deployment = {
          id: row.id,
          botId: row.botId,
          botName: row.botName,
          userId: row.userId ?? undefined,
          status: (row.status as DeploymentStatus) ?? "stopped",
          plan: (row.plan as "trial" | "monthly") ?? "trial",
          expiresAt: row.expiresAt?.toISOString() ?? undefined,
          envVars: (row.envVars as Record<string, string>) ?? {},
          url: row.url ?? undefined,
          pterodactylId: row.pterodactylId ?? undefined,
          pterodactylIdentifier: row.pterodactylIdentifier ?? undefined,
          createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
          updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
          logs: (row.logs as Deployment["logs"]) ?? [],
          metrics: (row.metrics as Deployment["metrics"]) ?? { cpu: 0, memory: 0, uptime: 0, requests: 0 },
        };
        // Mark any that were deploying/queued as failed (they can't resume after restart)
        if (dep.status === "deploying" || dep.status === "queued") {
          dep.status = "failed";
          dep.logs.push({ timestamp: new Date().toISOString(), level: "warn", message: "Server restarted — deployment interrupted." });
        }
        this.deployments.set(dep.id, dep);
      }
      console.log(`[storage] Loaded ${rows.length} deployments from database.`);
    } catch (err) {
      console.error("[storage] Failed to load deployments from DB:", err);
    }
  }

  private async persistDeployment(dep: Deployment): Promise<void> {
    try {
      await db.insert(deploymentsTable).values({
        id: dep.id,
        botId: dep.botId,
        botName: dep.botName,
        userId: dep.userId,
        status: dep.status,
        plan: dep.plan ?? "trial",
        expiresAt: dep.expiresAt ? new Date(dep.expiresAt) : undefined,
        envVars: dep.envVars,
        url: dep.url,
        pterodactylId: dep.pterodactylId,
        pterodactylIdentifier: dep.pterodactylIdentifier,
        logs: dep.logs,
        metrics: dep.metrics ?? { cpu: 0, memory: 0, uptime: 0, requests: 0 },
        createdAt: new Date(dep.createdAt),
        updatedAt: new Date(dep.updatedAt),
      }).onConflictDoUpdate({
        target: deploymentsTable.id,
        set: {
          status: dep.status,
          plan: dep.plan ?? "trial",
          expiresAt: dep.expiresAt ? new Date(dep.expiresAt) : undefined,
          url: dep.url,
          pterodactylId: dep.pterodactylId,
          pterodactylIdentifier: dep.pterodactylIdentifier,
          logs: dep.logs,
          metrics: dep.metrics ?? { cpu: 0, memory: 0, uptime: 0, requests: 0 },
          updatedAt: new Date(dep.updatedAt),
        },
      });
    } catch (err) {
      console.error("[storage] Failed to persist deployment:", err);
    }
  }

  private scheduleLogFlush(id: string): void {
    const existing = this.logFlushTimers.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      this.logFlushTimers.delete(id);
      const dep = this.deployments.get(id);
      if (dep) await this.persistDeployment(dep);
    }, 3000);
    this.logFlushTimers.set(id, timer);
  }

  async getBots(): Promise<Bot[]> {
    let rows = await db.select().from(platformBots);
    if (rows.length === 0) {
      await db.insert(platformBots).values(DEFAULT_BOTS).onConflictDoNothing();
      rows = await db.select().from(platformBots);
    }
    return rows
      .filter(r => r.active)
      .map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        repository: r.repository,
        logo: r.logo ?? undefined,
        pairSiteUrl: r.pairSiteUrl ?? undefined,
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
      pairSiteUrl: r.pairSiteUrl ?? undefined,
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

  async getDeployments(userId?: string): Promise<Deployment[]> {
    const all = Array.from(this.deployments.values());
    const filtered = userId ? all.filter(d => d.userId === userId) : all;
    return filtered.sort(
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
    userId?: string,
    plan?: "trial" | "monthly",
    expiresAt?: Date
  ): Promise<Deployment> {
    const id = randomUUID();

    const deployment: Deployment = {
      id,
      botId,
      botName,
      userId,
      status: "queued",
      plan: plan ?? "trial",
      expiresAt: expiresAt?.toISOString(),
      envVars,
      url: undefined,
      port: undefined,
      pterodactylId: undefined,
      pterodactylIdentifier: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [],
      metrics: { cpu: 0, memory: 0, uptime: 0, requests: 0 },
    };
    this.deployments.set(id, deployment);
    this.persistDeployment(deployment).catch(() => {});

    if (ptero.isPterodactylConfigured()) {
      this.runPterodactylDeployment(id, botName, botRepo, envVars).catch(async (err) => {
        await this.addDeploymentLog(id, "error", `Pterodactyl fatal: ${err.message}`);
        await this.updateDeploymentStatus(id, "failed");
      });
    } else {
      const deployDir = join(BASE_DIR, id);
      this.runDeployment(id, botRepo, deployDir, envVars).catch(async (err) => {
        await this.addDeploymentLog(id, "error", `Fatal: ${err.message}`);
        await this.updateDeploymentStatus(id, "failed");
      });
    }

    return deployment;
  }

  private async runPterodactylDeployment(
    id: string,
    botName: string,
    botRepo: string,
    envVars: Record<string, string>
  ): Promise<void> {
    await this.updateDeploymentStatus(id, "deploying");
    await this.addDeploymentLog(id, "info", "Provisioning server via Pterodactyl...");

    const server = await ptero.createServer({
      name: `wolfdeploy-${id.slice(0, 8)}`,
      botRepo,
      envVars,
    });

    const dep = this.deployments.get(id);
    if (dep) {
      dep.pterodactylId = server.id;
      dep.pterodactylIdentifier = server.identifier;
      dep.url = server.panelUrl;
      this.deployments.set(id, dep);
    }

    await this.addDeploymentLog(id, "info", `Server created: ${server.identifier} (ID: ${server.id})`);
    await this.addDeploymentLog(id, "info", `Panel URL: ${server.panelUrl}`);
    await this.addDeploymentLog(id, "info", "Waiting for server to install and start...");

    // Poll until server is running (up to 10 minutes)
    const maxWait = 10 * 60 * 1000;
    const interval = 15000;
    const started = Date.now();

    while (Date.now() - started < maxWait) {
      await new Promise(r => setTimeout(r, interval));
      try {
        const status = await ptero.getServerStatus(server.id);
        if (status === "running") {
          await this.addDeploymentLog(id, "success", "Bot server is online and running.");
          await this.updateDeploymentStatus(id, "running");
          return;
        }
        if (status === "suspended") {
          await this.addDeploymentLog(id, "error", "Server was suspended by the panel.");
          await this.updateDeploymentStatus(id, "failed");
          return;
        }
        await this.addDeploymentLog(id, "info", `Server status: ${status}...`);
      } catch (e: any) {
        await this.addDeploymentLog(id, "warn", `Status poll error: ${e.message}`);
      }
    }

    await this.addDeploymentLog(id, "warn", "Timed out waiting for server. Marking as running — check panel.");
    await this.updateDeploymentStatus(id, "running");
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

    await this.addDeploymentLog(id, "info", "Installing PostgreSQL driver (pg)...");
    await this.spawnStep(id, "npm", ["install", "pg", "--no-audit"], { cwd: deployDir });
    await this.addDeploymentLog(id, "info", "PostgreSQL driver installed.");

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
    this.persistDeployment(dep).catch(() => {});
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
    this.scheduleLogFlush(id);
  }

  async stopDeployment(id: string): Promise<Deployment | undefined> {
    const dep = this.deployments.get(id);

    if (dep?.pterodactylId) {
      await this.addDeploymentLog(id, "warn", "Sending stop signal to Pterodactyl server...");
      try {
        await ptero.deleteServer(dep.pterodactylId);
        await this.addDeploymentLog(id, "info", "Pterodactyl server deleted.");
      } catch (e: any) {
        await this.addDeploymentLog(id, "warn", `Could not stop Pterodactyl server: ${e.message}`);
      }
    } else {
      const proc = this.processes.get(id);
      if (proc && !proc.killed) {
        await this.addDeploymentLog(id, "warn", "Received stop signal. Sending SIGTERM to bot process...");
        proc.kill("SIGTERM");
        setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
        this.processes.delete(id);
      } else {
        await this.addDeploymentLog(id, "warn", "No running process found for this deployment.");
      }
    }

    await this.addDeploymentLog(id, "info", "Bot stopped.");
    return this.updateDeploymentStatus(id, "stopped");
  }

  async deleteDeployment(id: string): Promise<boolean> {
    const dep = this.deployments.get(id);

    if (dep?.pterodactylId) {
      try {
        await ptero.deleteServer(dep.pterodactylId);
      } catch (_) {}
    } else {
      const proc = this.processes.get(id);
      if (proc && !proc.killed) {
        proc.kill("SIGKILL");
        this.processes.delete(id);
      }
      const deployDir = join(BASE_DIR, id);
      if (existsSync(deployDir)) {
        try { rmSync(deployDir, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // Remove from DB
    try {
      await db.delete(deploymentsTable).where(eq(deploymentsTable.id, id));
    } catch (_) {}

    return this.deployments.delete(id);
  }
}

export const storage = new MemStorage();
