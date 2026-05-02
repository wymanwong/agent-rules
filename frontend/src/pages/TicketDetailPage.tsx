import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconCalendar,
  IconCategory,
  IconChartDots,
  IconMessageCircle,
  IconPaperclip,
  IconTimeline,
  IconUpload,
  IconUser,
  IconUsersGroup,
} from '@tabler/icons-react';
import { api, apiMultipart, authorizedDelete, fetchAuthorizedBlob } from '../api';
import { AttachmentPicker } from '../components/AttachmentPicker';
import {
  AttachmentPreviewModal,
  attachmentPreviewCategory,
} from '../components/AttachmentPreviewModal';
import { VoiceToTextButton } from '../components/VoiceToTextButton';
import { useAuth } from '../auth/AuthContext';

interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  impact: string;
  urgency: string;
  category: string | null;
  due_at: string | null;
  created_at: string;
  requester_id: number;
  catalog_item_id: number | null;
}

interface Comment {
  id: number;
  author_id: number;
  is_internal: number;
  body: string;
  created_at: string;
}

interface Approval {
  id: number;
  approver_user_id: number;
  status: string;
  comment: string | null;
}

interface AssignmentRow {
  id: number;
  from_user_id: number | null;
  to_user_id: number | null;
  from_team_id: number | null;
  to_team_id: number | null;
  changed_at: string;
}

interface AttachmentMeta {
  id: number;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_user_id: number;
  created_at: string;
}

const incidentStatuses = ['New', 'InTriage', 'InProgress', 'PendingUser', 'Pending3rdParty', 'Resolved', 'Closed'];
const srStatuses = ['New', 'AwaitingApproval', 'Approved', 'InProgress', 'Completed', 'Closed'];

/** How often to refetch ticket detail while this page is open (ms). */
const TICKET_POLL_MS = 15_000;

/** Solid Tabler `text-bg-*` pairs — avoids unreadable lt+tint combos under `.badge`. */
function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'P1':
      return 'badge text-bg-danger';
    case 'P2':
      return 'badge text-bg-orange';
    case 'P3':
      return 'badge text-bg-azure';
    case 'P4':
      return 'badge text-bg-secondary';
    default:
      return 'badge text-bg-secondary';
  }
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  let cls = 'badge text-bg-primary';
  if (s === 'closed' || s === 'resolved' || s === 'completed') cls = 'badge text-bg-success';
  else if (s.startsWith('pending')) cls = 'badge text-bg-warning';
  else if (s === 'new' || s === 'awaitingapproval') cls = 'badge text-bg-azure';
  else if (s === 'approved') cls = 'badge text-bg-teal';
  return cls;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ticketListBackPath(role?: string): string {
  if (role === 'EndUser') return '/my-requests';
  if (role === 'IT' || role === 'Admin') return '/it/queue';
  return '/';
}

/** Display PascalCase workflow labels with spaces (e.g. InProgress → In Progress). */
function spacedLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').trim();
}

export function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<{
    ticket: Ticket;
    catalog_item?: { id: number; name: string | null } | null;
    requester?: { id: number; name: string; email?: string };
    comments: Comment[];
    approvals: Approval[];
    assignment_history: AssignmentRow[];
    attachments?: AttachmentMeta[];
    assignee?: { id: number; name: string };
    team?: { id: number; name: string };
  } | null>(null);
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState('');
  const [approverComment, setApproverComment] = useState('');
  const [moreFiles, setMoreFiles] = useState<File[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewMime, setPreviewMime] = useState('');
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);

  function revokePreviewBlob() {
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setPreviewBlobUrl(null);
  }

  function closePreview() {
    revokePreviewBlob();
    setPreviewOpen(false);
    setPreviewText(null);
    setPreviewError(null);
    setPreviewLoading(false);
  }

  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
      }
    };
  }, []);

  const refresh = useCallback(
    async (opts?: { clearPendingUploads?: boolean }) => {
      if (!id) return;
      const res = await api<typeof data>(`/tickets/${id}`);
      setData(res as typeof data);
      if (res?.ticket) setStatusDraft(res.ticket.status);
      if (opts?.clearPendingUploads !== false) setMoreFiles([]);
    },
    [id],
  );

  useEffect(() => {
    void refresh().catch(() => navigate('/'));
  }, [id, refresh, navigate]);

  useEffect(() => {
    if (!id) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      void refresh({ clearPendingUploads: false }).catch(() => {
        /* ignore background poll errors */
      });
    };
    const timer = window.setInterval(tick, TICKET_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, refresh]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !comment.trim()) return;
    setError(null);
    try {
      await api(`/tickets/${id}/comments`, {
        method: 'POST',
        json: { body: comment, is_internal: internal },
      });
      setComment('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function applyStatus() {
    if (!id || !user || user.role === 'EndUser') return;
    setError(null);
    try {
      await api(`/tickets/${id}`, {
        method: 'PATCH',
        json: { status: statusDraft },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function closeTicket() {
    if (!id) return;
    setError(null);
    try {
      await api(`/tickets/${id}`, { method: 'PATCH', json: { status: 'Closed' } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function downloadAttachment(att: AttachmentMeta) {
    if (!id) return;
    setError(null);
    try {
      const blob = await fetchAuthorizedBlob(`/tickets/${id}/attachments/${att.id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.original_filename || `attachment-${att.id}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  async function openPreview(att: AttachmentMeta) {
    if (!id) return;
    setError(null);
    revokePreviewBlob();
    setPreviewTitle(att.original_filename || `Attachment ${att.id}`);
    setPreviewMime(att.mime_type || '');
    setPreviewText(null);
    setPreviewError(null);
    setPreviewOpen(true);
    const kind = attachmentPreviewCategory(att.mime_type || '');

    if (kind === 'none') {
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    try {
      const blob = await fetchAuthorizedBlob(`/tickets/${id}/attachments/${att.id}/download`);
      if (kind === 'text') {
        const text = await blob.text();
        setPreviewText(text);
        setPreviewLoading(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      previewBlobUrlRef.current = url;
      setPreviewBlobUrl(url);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function removeAttachment(att: AttachmentMeta) {
    if (!id) return;
    setError(null);
    try {
      await authorizedDelete(`/tickets/${id}/attachments/${att.id}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function uploadMoreAttachments(e: React.FormEvent) {
    e.preventDefault();
    if (!id || moreFiles.length === 0) return;
    setError(null);
    try {
      const fd = new FormData();
      for (const f of moreFiles) fd.append('attachments', f);
      await apiMultipart<{ attachments: AttachmentMeta[] }>(`/tickets/${id}/attachments/multipart`, fd);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  async function decideApproval(approvalId: number, status: 'Approved' | 'Rejected') {
    if (!id) return;
    setError(null);
    try {
      await api(`/tickets/${id}/approvals/${approvalId}/decision`, {
        method: 'POST',
        json: { status, comment: approverComment || undefined },
      });
      setApproverComment('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  if (!data) {
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="text-secondary d-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden />
          Loading ticket…
        </div>
      </div>
    );
  }

  const { ticket, comments, approvals, assignment_history: history } = data;
  const attachments = data.attachments ?? [];
  const statuses = ticket.type === 'Incident' ? incidentStatuses : srStatuses;
  const canClose =
    user?.role === 'EndUser' &&
    ((ticket.type === 'Incident' && ticket.status === 'Resolved') ||
      (ticket.type === 'ServiceRequest' && ticket.status === 'Completed'));

  const showInternal = user && (user.role === 'IT' || user.role === 'Admin');

  const pendingApproval =
    user && approvals.find((a) => a.status === 'Pending' && a.approver_user_id === user.id);

  const typeLabel = ticket.type === 'ServiceRequest' ? 'Service request' : 'Incident';
  const canRemoveAttachment =
    user?.role === 'IT' ||
    user?.role === 'Admin' ||
    (user?.role === 'EndUser' && ticket.requester_id === user.id);

  return (
    <>
      <AttachmentPreviewModal
        open={previewOpen}
        filename={previewTitle}
        mimeType={previewMime}
        blobUrl={previewBlobUrl}
        textContent={previewText}
        loading={previewLoading}
        error={previewError}
        onClose={closePreview}
      />

      <div className="page-header d-print-none mb-4 pb-2 pb-lg-3">
        <div className="text-secondary small mb-1">
          <Link to={ticketListBackPath(user?.role)} className="text-reset text-decoration-none">
            <IconArrowLeft size={16} className="icon icon-inline me-1" aria-hidden />
            Back to list
          </Link>
        </div>
        <h1 className="page-title mb-2">
          <span className="text-secondary fw-normal me-2">{ticket.ticket_number}</span>
          <span className="d-inline-block">{ticket.title}</span>
        </h1>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="badge text-bg-secondary">{typeLabel}</span>
          <span className={statusBadgeClass(ticket.status)}>{spacedLabel(ticket.status)}</span>
          <span className={priorityBadgeClass(ticket.priority)}>{ticket.priority}</span>
          <span className="text-secondary small d-flex align-items-center gap-1">
            <IconChartDots size={16} stroke={1.5} aria-hidden />
            Impact {ticket.impact} · Urgency {ticket.urgency}
          </span>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        <div className="col-12">
          <div className="card mb-4">
            <div className="card-header">
              <h2 className="card-title mb-0">Description</h2>
            </div>
            <div className="card-body">
              <div className="ticket-description-body text-body">{ticket.description || '—'}</div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <h2 className="card-title mb-0">Details</h2>
            </div>
            <div className="card-body">
              <dl className="row mb-0 gy-2 small">
                <dt className="col-sm-4 col-lg-3 text-secondary">Opened</dt>
                <dd className="col-sm-8 col-lg-9 mb-0 d-flex align-items-start gap-1">
                  <IconCalendar size={16} className="icon text-secondary flex-shrink-0 mt-1" aria-hidden />
                  <span>{new Date(ticket.created_at).toLocaleString()}</span>
                </dd>
                {ticket.due_at && (
                  <>
                    <dt className="col-sm-4 col-lg-3 text-secondary">SLA due</dt>
                    <dd className="col-sm-8 col-lg-9 mb-0 fw-medium">{new Date(ticket.due_at).toLocaleString()}</dd>
                  </>
                )}
                {ticket.category && (
                  <>
                    <dt className="col-sm-4 col-lg-3 text-secondary">Category</dt>
                    <dd className="col-sm-8 col-lg-9 mb-0 d-flex align-items-center gap-1">
                      <IconCategory size={16} className="icon text-secondary" aria-hidden />
                      {ticket.category}
                    </dd>
                  </>
                )}
                <dt className="col-sm-4 col-lg-3 text-secondary">Requester</dt>
                <dd className="col-sm-8 col-lg-9 mb-0 d-flex align-items-center gap-1">
                  <IconUser size={16} className="icon text-secondary" aria-hidden />
                  {data.requester ? (
                    <>
                      {data.requester.name}
                      <span className="text-secondary">· #{ticket.requester_id}</span>
                    </>
                  ) : (
                    <>#{ticket.requester_id}</>
                  )}
                </dd>
                <dt className="col-sm-4 col-lg-3 text-secondary">Assignee</dt>
                <dd className="col-sm-8 col-lg-9 mb-0">
                  {data.assignee ? (
                    <span className="d-flex align-items-center gap-1">
                      <IconUser size={16} className="icon text-secondary" aria-hidden />
                      {data.assignee.name}
                    </span>
                  ) : (
                    <span className="text-secondary">Unassigned</span>
                  )}
                </dd>
                <dt className="col-sm-4 col-lg-3 text-secondary">Team</dt>
                <dd className="col-sm-8 col-lg-9 mb-0 d-flex align-items-center gap-1">
                  <IconUsersGroup size={16} className="icon text-secondary" aria-hidden />
                  {data.team?.name ?? '—'}
                </dd>
                {ticket.type === 'ServiceRequest' && data.catalog_item?.id != null && (
                  <>
                    <dt className="col-sm-4 col-lg-3 text-secondary">Catalog</dt>
                    <dd className="col-sm-8 col-lg-9 mb-0">{data.catalog_item.name ?? `Item #${data.catalog_item.id}`}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <h2 className="card-title mb-0 d-flex align-items-center gap-2">
                <IconPaperclip size={20} stroke={1.5} aria-hidden />
                Attachments
                <span className="badge text-bg-secondary ms-1">{attachments.length}</span>
              </h2>
            </div>
            <div className="card-body">
              {attachments.length === 0 ? (
                <p className="text-secondary mb-0">No attachments yet.</p>
              ) : (
                <div className="list-group list-group-flush">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="list-group-item px-0 d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="fw-medium text-truncate" title={att.original_filename}>
                          {att.original_filename}
                        </div>
                        <div className="text-secondary small">
                          {formatFileSize(att.size_bytes)}
                          {att.mime_type ? ` · ${att.mime_type}` : ''}
                        </div>
                      </div>
                      <div className="btn-list flex-shrink-0">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void openPreview(att)}>
                          Preview
                        </button>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => void downloadAttachment(att)}>
                          Download
                        </button>
                        {canRemoveAttachment && (
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void removeAttachment(att)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <hr className="my-4" />

              <form onSubmit={uploadMoreAttachments}>
                <h3 className="h4 mb-3 d-flex align-items-center gap-2">
                  <IconUpload size={20} stroke={1.5} aria-hidden />
                  Add files
                </h3>
                <AttachmentPicker files={moreFiles} onFilesChange={setMoreFiles} />
                <button type="submit" className="btn btn-primary mt-2" disabled={moreFiles.length === 0}>
                  Upload
                </button>
              </form>
            </div>
          </div>

          {ticket.type === 'ServiceRequest' && approvals.length > 0 && (
            <div className="card mb-4">
              <div className="card-header">
                <h2 className="card-title mb-0">Approvals</h2>
              </div>
              <div className="card-body">
                {approvals.map((a) => (
                  <div key={a.id} className="mb-3 pb-3 border-bottom border-bottom-dashed">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <span className="text-secondary small">#{a.id}</span>
                      <span className="text-secondary small">Approver user {a.approver_user_id}</span>
                      <span className={statusBadgeClass(a.status)}>{a.status}</span>
                    </div>
                    {pendingApproval?.id === a.id && (
                      <div className="btn-list mt-3">
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => void decideApproval(a.id, 'Approved')}>
                          Approve
                        </button>
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void decideApproval(a.id, 'Rejected')}>
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {pendingApproval && (
                  <div className="mt-2">
                    <label className="form-label" htmlFor="approval-comment">
                      Approval comment
                    </label>
                    <input
                      id="approval-comment"
                      type="text"
                      className="form-control"
                      value={approverComment}
                      onChange={(e) => setApproverComment(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card mb-4">
            <div className="card-header">
              <h2 className="card-title mb-0 d-flex align-items-center gap-2">
                <IconMessageCircle size={20} stroke={1.5} aria-hidden />
                Activity
                <span className="badge text-bg-secondary ms-1">{comments.length}</span>
              </h2>
            </div>
            <div className="card-body">
              {comments.length === 0 ? (
                <p className="text-secondary mb-0">No comments yet.</p>
              ) : (
                <div className="ticket-comment-thread">
                  {comments.map((c) => (
                    <div key={c.id} className="ticket-comment">
                      <div className="d-flex flex-wrap align-items-baseline gap-2 mb-1">
                        <span className="fw-medium">User #{c.author_id}</span>
                        <span className="text-secondary small">{new Date(c.created_at).toLocaleString()}</span>
                        {c.is_internal === 1 && <span className="badge text-bg-warning">Internal</span>}
                      </div>
                      <div className="text-body" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {c.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <hr className="my-4" />

              <form onSubmit={postComment}>
                <h3 className="h4 mb-3">Add {internal ? 'internal note' : 'comment'}</h3>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <VoiceToTextButton onAppend={(t) => setComment((prev) => `${prev}${t}`)} />
                </div>
                <textarea
                  className="form-control mb-3"
                  rows={4}
                  placeholder={internal ? 'Internal note (visible to IT only)' : 'Write a comment…'}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                {showInternal && (
                  <div className="btn-list mb-3">
                    <button
                      type="button"
                      className={`btn btn-sm ${internal ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setInternal(true)}
                    >
                      Internal
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${!internal ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setInternal(false)}
                    >
                      External
                    </button>
                  </div>
                )}
                <div className="btn-list">
                  <button type="submit" className="btn btn-primary" disabled={!comment.trim()}>
                    Post
                  </button>
                  {canClose && (
                    <button type="button" className="btn btn-outline-secondary" onClick={() => void closeTicket()}>
                      Close ticket
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {showInternal && (
            <div className="card mb-4">
              <div className="card-header">
                <h2 className="card-title mb-0 d-flex align-items-center gap-2">
                  <IconTimeline size={20} stroke={1.5} aria-hidden />
                  IT actions
                </h2>
              </div>
              <div className="card-body">
                <label className="form-label" htmlFor="ticket-status">
                  Status
                </label>
                <select
                  id="ticket-status"
                  className="form-select mb-3"
                  value={statusDraft}
                  onChange={(e) => setStatusDraft(e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {spacedLabel(s)}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-primary w-100" onClick={() => void applyStatus()}>
                  Update status
                </button>

                <h3 className="h5 mt-4 mb-2">Assignment history</h3>
                {history.length === 0 ? (
                  <p className="text-secondary small mb-0">No assignment events yet.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-vcenter card-table mb-0">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Users</th>
                          <th>Teams</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h) => (
                          <tr key={h.id}>
                            <td className="text-secondary small text-nowrap">{new Date(h.changed_at).toLocaleString()}</td>
                            <td className="small">
                              {h.from_user_id ?? '—'} → {h.to_user_id ?? '—'}
                            </td>
                            <td className="small">
                              {h.from_team_id ?? '—'} → {h.to_team_id ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
