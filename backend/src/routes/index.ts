import type { Express } from 'express';
import { Router } from 'express';
import type { Database } from 'better-sqlite3';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';
import { optionalAuthenticate } from '../middleware/optionalAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createAuthController } from '../controllers/authController.js';
import { createTicketController } from '../controllers/ticketController.js';
import { createCatalogController } from '../controllers/catalogController.js';
import { createKnowledgeController } from '../controllers/knowledgeController.js';
import { createAdminController } from '../controllers/adminController.js';

export function registerRoutes(app: Express, db: Database): void {
  const auth = createAuthController(db);
  const tickets = createTicketController(db);
  const catalog = createCatalogController(db);
  const knowledge = createKnowledgeController(db);
  const admin = createAdminController(db);

  app.post('/auth/login', asyncHandler(auth.login.bind(auth)));
  app.get('/auth/me', authenticate, auth.me.bind(auth));

  app.get('/knowledge/articles', optionalAuthenticate, knowledge.list.bind(knowledge));
  app.get('/knowledge/articles/:id', optionalAuthenticate, knowledge.getById.bind(knowledge));

  const api = Router();
  api.use(authenticate);

  api.post('/tickets', tickets.create.bind(tickets));
  api.get('/tickets', tickets.list.bind(tickets));
  api.get('/tickets/:id', tickets.getById.bind(tickets));
  api.patch('/tickets/:id', tickets.patch.bind(tickets));
  api.post('/tickets/:id/comments', tickets.addComment.bind(tickets));
  api.get('/tickets/:id/approvals', tickets.listApprovals.bind(tickets));
  api.post('/tickets/:id/approvals/:approvalId/decision', tickets.approvalDecision.bind(tickets));

  api.get('/catalog/items', (req: AuthRequest, res, next) => {
    if (req.user?.role === 'Admin') return catalog.listAll(req, res);
    return catalog.listPublished(req, res);
  });
  api.get('/catalog/items/:id', authorize('Admin'), catalog.getById.bind(catalog));

  api.post('/catalog/items', authorize('Admin'), catalog.create.bind(catalog));
  api.patch('/catalog/items/:id', authorize('Admin'), catalog.update.bind(catalog));
  api.delete('/catalog/items/:id', authorize('Admin'), catalog.delete.bind(catalog));
  api.post('/catalog/items/:id/requests', catalog.requestFromCatalog.bind(catalog));

  api.post('/knowledge/articles', authorize('Admin'), knowledge.create.bind(knowledge));
  api.patch('/knowledge/articles/:id', authorize('Admin'), knowledge.update.bind(knowledge));
  api.delete('/knowledge/articles/:id', authorize('Admin'), knowledge.delete.bind(knowledge));

  api.get('/admin/users', authorize('Admin'), admin.listUsers.bind(admin));
  api.post('/admin/users', authorize('Admin'), asyncHandler(admin.createUser.bind(admin)));
  api.patch('/admin/users/:id', authorize('Admin'), asyncHandler(admin.updateUser.bind(admin)));
  api.delete('/admin/users/:id', authorize('Admin'), admin.deleteUser.bind(admin));

  api.get('/admin/teams', authorize('Admin'), admin.listTeams.bind(admin));
  api.post('/admin/teams', authorize('Admin'), admin.createTeam.bind(admin));
  api.patch('/admin/teams/:id', authorize('Admin'), admin.updateTeam.bind(admin));
  api.delete('/admin/teams/:id', authorize('Admin'), admin.deleteTeam.bind(admin));

  app.use(api);
}
