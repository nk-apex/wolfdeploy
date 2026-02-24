const PANEL_URL = (process.env.PTERODACTYL_URL ?? "").replace(/\/$/, "");
const APP_KEY = process.env.PTERODACTYL_API_KEY ?? "";
const OWNER_ID = parseInt(process.env.PTERODACTYL_OWNER_ID ?? "1", 10);
const EGG_ID = parseInt(process.env.PTERODACTYL_EGG_ID ?? "15", 10);
const NEST_ID = parseInt(process.env.PTERODACTYL_NEST_ID ?? "1", 10);
const LOCATION_ID = parseInt(process.env.PTERODACTYL_LOCATION_ID ?? "1", 10);
const RAM_MB = parseInt(process.env.PTERODACTYL_RAM ?? "512", 10);
const DISK_MB = parseInt(process.env.PTERODACTYL_DISK ?? "2048", 10);
const CPU_PCT = parseInt(process.env.PTERODACTYL_CPU ?? "100", 10);
const DOCKER_IMAGE = process.env.PTERODACTYL_DOCKER_IMAGE ?? "ghcr.io/pterodactyl/yolks:nodejs_18";
const STARTUP_CMD = process.env.PTERODACTYL_STARTUP ?? "npm install --legacy-peer-deps && node index.js";

export function isPterodactylConfigured(): boolean {
  return !!(PANEL_URL && APP_KEY);
}

function appHeaders() {
  return {
    Authorization: `Bearer ${APP_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export type PteroServer = {
  id: number;
  uuid: string;
  identifier: string;
  panelUrl: string;
};

export async function createServer(params: {
  name: string;
  botRepo: string;
  envVars: Record<string, string>;
}): Promise<PteroServer> {
  const environment: Record<string, string> = {
    GIT_ADDRESS: params.botRepo,
    BRANCH: process.env.PTERODACTYL_BRANCH ?? "main",
    USER_UPLOAD: "0",
    AUTO_UPDATE: "0",
    MAIN_FILE: process.env.PTERODACTYL_MAIN_FILE ?? "index.js",
    NODE_PACKAGES: "",
    UNNODE_PACKAGES: "",
    NODE_ARGS: "",
    USERNAME: "",
    ACCESS_TOKEN: "",
    ...params.envVars,
  };

  const body = {
    name: params.name.slice(0, 48),
    user: OWNER_ID,
    egg: EGG_ID,
    docker_image: DOCKER_IMAGE,
    startup: STARTUP_CMD,
    environment,
    limits: { memory: RAM_MB, swap: 0, disk: DISK_MB, io: 500, cpu: CPU_PCT },
    feature_limits: { databases: 0, allocations: 1, backups: 0 },
    deploy: { locations: [LOCATION_ID], dedicated_ip: false, port_range: [] },
  };

  const res = await fetch(`${PANEL_URL}/api/application/servers`, {
    method: "POST",
    headers: appHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pterodactyl create server failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as any;
  const attr = data.attributes;
  return {
    id: attr.id,
    uuid: attr.uuid,
    identifier: attr.identifier,
    panelUrl: `${PANEL_URL}/server/${attr.identifier}`,
  };
}

export async function getServerStatus(serverId: number): Promise<"installing" | "running" | "offline" | "suspended"> {
  const res = await fetch(`${PANEL_URL}/api/application/servers/${serverId}`, {
    headers: appHeaders(),
  });
  if (!res.ok) throw new Error(`Pterodactyl get server failed (${res.status})`);
  const data = (await res.json()) as any;
  const attr = data.attributes;
  if (attr.suspended) return "suspended";
  const s = attr.status as string | null;
  if (!s || s === "running") return "running";
  if (s === "installing" || s === "restoring_backup") return "installing";
  return "offline";
}

export async function deleteServer(serverId: number): Promise<void> {
  const res = await fetch(`${PANEL_URL}/api/application/servers/${serverId}/force`, {
    method: "DELETE",
    headers: appHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Pterodactyl delete server failed (${res.status})`);
  }
}

export async function reinstallServer(serverId: number): Promise<void> {
  const res = await fetch(`${PANEL_URL}/api/application/servers/${serverId}/reinstall`, {
    method: "POST",
    headers: appHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Pterodactyl reinstall server failed (${res.status})`);
  }
}
