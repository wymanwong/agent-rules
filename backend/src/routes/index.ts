import type { Express } from 'express';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.js';
import { authenticateSse } from '../middleware/sseAuth.js';
import { optionalAuthenticate } from '../middleware/optionalAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createAuthController } from '../controllers/authController.js';
import { createTicketController } from '../controllers/ticketController.js';
import { createCatalogController } from '../controllers/catalogController.js';
import { createKnowledgeController } from '../controllers/knowledgeController.js';
import { createAdminController } from '../controllers/adminController.js';
import { createItStaffController } from '../controllers/itStaffController.js';
import { uploadAttachmentsMemory } from '../middleware/upload.js';
import { liveSse } from '../controllers/sseController.js';

export function registerRoutes(app: Express, _db: PoolClient | null): void {
  void _db;
  const auth = createAuthController(null);
  const tickets = createTicketController(null);
  const catalog = createCatalogController(null);
  const knowledge = createKnowledgeController(null);
  const admin = createAdminController(null);
  const itStaff = createItStaffController(null);

  app.post('/auth/login', asyncHandler(auth.login.bind(auth)));
  app.get('/auth/me', authenticate, asyncHandler(auth.me.bind(auth)));

  app.get('/live/stream', authenticateSse, liveSse);

  app.get('/knowledge/articles', optionalAuthenticate, asyncHandler(knowledge.list.bind(knowledge)));
  app.get('/knowledge/articles/:id', optionalAuthenticate, asyncHandler(knowledge.getById.bind(knowledge)));

  const api = Router();
  api.use(authenticate);

  api.post('/tickets', asyncHandler(tickets.create.bind(tickets)));
  api.post('/tickets/multipart', uploadAttachmentsMemory(), asyncHandler(tickets.createMultipart.bind(tickets)));
  api.get('/it/staff', authorize('IT', 'Admin'), asyncHandler(itStaff.list.bind(itStaff)));
  api.get('/tickets', asyncHandler(tickets.list.bind(tickets)));
  api.get('/tickets/:ticketId/attachments/:attachmentId/download', asyncHandler(tickets.downloadAttachment.bind(tickets)));
  api.delete('/tickets/:ticketId/attachments/:attachmentId', asyncHandler(tickets.deleteAttachment.bind(tickets)));
  api.post('/tickets/:id/attachments/multipart', uploadAttachmentsMemory(), asyncHandler(tickets.addAttachmentsMultipart.bind(tickets)));
  api.get('/tickets/:id', asyncHandler(tickets.getById.bind(tickets)));
  api.patch('/tickets/:id', asyncHandler(tickets.patch.bind(tickets)));
  api.post('/tickets/:id/comments', asyncHandler(tickets.addComment.bind(tickets)));
  api.get('/tickets/:id/approvals', asyncHandler(tickets.listApprovals.bind(tickets)));
  api.post('/tickets/:id/approvals/:approvalId/decision', asyncHandler(tickets.approvalDecision.bind(tickets)));

  api.get(
    '/catalog/items',
    asyncHandler(async (req: AuthRequest, res) => {
      if (req.user?.role === 'Admin') await catalog.listAll(req, res);
      else await catalog.listPublished(req, res);
    }),
  );
  api.get('/catalog/items/:id', authorize('Admin'), asyncHandler(catalog.getById.bind(catalog)));

  api.post('/catalog/items', authorize('Admin'), asyncHandler(catalog.create.bind(catalog)));
  api.patch('/catalog/items/:id', authorize('Admin'), asyncHandler(catalog.update.bind(catalog)));
  api.delete('/catalog/items/:id', authorize('Admin'), asyncHandler(catalog.delete.bind(catalog)));
  api.post('/catalog/items/:id/requests', asyncHandler(catalog.requestFromCatalog.bind(catalog)));
  api.post(
    '/catalog/items/:id/requests/multipart',
    uploadAttachmentsMemory(),
    asyncHandler(catalog.requestFromCatalogMultipart.bind(catalog)),
  );

  api.post('/knowledge/articles', authorize('Admin'), asyncHandler(knowledge.create.bind(knowledge)));
  api.patch('/knowledge/articles/:id', authorize('Admin'), asyncHandler(knowledge.update.bind(knowledge)));
  api.delete('/knowledge/articles/:id', authorize('Admin'), asyncHandler(knowledge.delete.bind(knowledge)));

  api.get('/admin/users', authorize('Admin'), asyncHandler(admin.listUsers.bind(admin)));
  api.post('/admin/users', authorize('Admin'), asyncHandler(admin.createUser.bind(admin)));
  api.patch('/admin/users/:id', authorize('Admin'), asyncHandler(admin.updateUser.bind(admin)));
  api.delete('/admin/users/:id', authorize('Admin'), asyncHandler(admin.deleteUser.bind(admin)));

  api.get('/admin/teams', authorize('Admin'), asyncHandler(admin.listTeams.bind(admin)));
  api.post('/admin/teams', authorize('Admin'), asyncHandler(admin.createTeam.bind(admin)));
  api.patch('/admin/teams/:id', authorize('Admin'), asyncHandler(admin.updateTeam.bind(admin)));
  api.delete('/admin/teams/:id', authorize('Admin'), asyncHandler(admin.deleteTeam.bind(admin)));

  app.use(api);
}
