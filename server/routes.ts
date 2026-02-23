import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { deployRequestSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/bots", async (_req, res) => {
    const bots = await storage.getBots();
    res.json(bots);
  });

  app.get("/api/bots/:id", async (req, res) => {
    const bot = await storage.getBot(req.params.id);
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    res.json(bot);
  });

  app.get("/api/bots/:id/app.json", async (req, res) => {
    const bot = await storage.getBot(req.params.id);
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    res.json({
      name: bot.name,
      description: bot.description,
      repository: bot.repository,
      keywords: bot.keywords,
      env: bot.env,
    });
  });

  app.get("/api/deployments", async (_req, res) => {
    const deployments = await storage.getDeployments();
    res.json(deployments);
  });

  app.get("/api/deployments/:id", async (req, res) => {
    const deployment = await storage.getDeployment(req.params.id);
    if (!deployment) return res.status(404).json({ error: "Deployment not found" });
    res.json(deployment);
  });

  app.get("/api/deployments/:id/logs", async (req, res) => {
    const deployment = await storage.getDeployment(req.params.id);
    if (!deployment) return res.status(404).json({ error: "Deployment not found" });
    res.json(deployment.logs);
  });

  app.post("/api/deploy", async (req, res) => {
    const result = deployRequestSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.message });

    const bot = await storage.getBot(result.data.botId);
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    const deployment = await storage.createDeployment(
      result.data.botId,
      bot.name,
      bot.repository,
      result.data.envVars
    );
    res.status(201).json(deployment);
  });

  app.post("/api/deployments/:id/stop", async (req, res) => {
    const deployment = await storage.stopDeployment(req.params.id);
    if (!deployment) return res.status(404).json({ error: "Deployment not found" });
    res.json(deployment);
  });

  app.delete("/api/deployments/:id", async (req, res) => {
    const ok = await storage.deleteDeployment(req.params.id);
    if (!ok) return res.status(404).json({ error: "Deployment not found" });
    res.json({ success: true });
  });

  return httpServer;
}
