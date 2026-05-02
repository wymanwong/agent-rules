import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiMultipart, authorizedDelete, fetchAuthorizedBlob } from '../api';
import { AttachmentPicker } from '../components/AttachmentPicker';
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

export function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<{
    ticket: Ticket;
    catalog_item?: { id: number; name: string | null } | null;
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

  async function refresh() {
    if (!id) return;
    const res = await api<typeof data>(`/tickets/${id}`);
    setData(res as typeof data);
    if (res?.ticket) setStatusDraft(res.ticket.status);
    setMoreFiles([]);
  }

  useEffect(() => {
    void refresh().catch(() => navigate('/'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  if (!data) return <div className="text-secondary">Loading…</div>;

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

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">
          {ticket.ticket_number} — {ticket.title}
        </h2>
        <div className="text-secondary">
          {ticket.type} · {ticket.status} · {ticket.priority} · Impact {ticket.impact} / Urgency {ticket.urgency}
        </div>
        {ticket.type === 'ServiceRequest' && data.catalog_item?.id != null && (
          <div className="text-secondary mt-2">
            Catalog offering: <strong>{data.catalog_item.name ?? `Item #${data.catalog_item.id}`}</strong> (catalog ID{' '}
            {data.catalog_item.id})
          </div>
        )}
        {ticket.due_at && (
          <div className="mt-2">
            SLA due: <strong>{new Date(ticket.due_at).toLocaleString()}</strong>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <hr />

      <h3 className="mt-4">Description</h3>
      <p className="mb-4">{ticket.description}</p>

      <h3 className="mb-3">Attachments</h3>
      {attachments.length === 0 && <p className="text-secondary mb-3">No attachments yet.</p>}
      {attachments.map((att) => (
        <div key={att.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <span>
            {att.original_filename} ({Math.round(att.size_bytes / 1024)} KB)
          </span>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void downloadAttachment(att)}>
            Download
          </button>
          {(user?.role === 'IT' ||
            user?.role === 'Admin' ||
            (user?.role === 'EndUser' && ticket.requester_id === user.id)) && (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void removeAttachment(att)}>
              Remove
            </button>
          )}
        </div>
      ))}

      <form onSubmit={uploadMoreAttachments} className="mb-4">
        <h4 className="h5 mt-4 mb-2">Add attachments</h4>
        <AttachmentPicker files={moreFiles} onFilesChange={setMoreFiles} />
        <button type="submit" className="btn btn-outline-primary btn-sm" disabled={moreFiles.length === 0}>
          Upload files
        </button>
      </form>

      {ticket.type === 'ServiceRequest' && approvals.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title mb-0">Approvals</h3>
          </div>
          <div className="card-body">
            {approvals.map((a) => (
              <div key={a.id} className="mb-3">
                <div>
                  #{a.id} — approver user {a.approver_user_id}: <span className="badge bg-secondary">{a.status}</span>
                </div>
                {pendingApproval?.id === a.id && (
                  <div className="btn-list mt-2">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void decideApproval(a.id, 'Approved')}>
                      Approve
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => void decideApproval(a.id, 'Rejected')}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
            {pendingApproval && (
              <div className="mt-2">
                <label className="form-label">Approval comment</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={approverComment}
                  onChange={(e) => setApproverComment(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {showInternal && (
        <>
          <h3 className="mb-2">Assignment history</h3>
          <div className="table-responsive mb-4">
            <table className="table table-sm table-bordered">
              <thead>
                <tr>
                  <th>When</th>
                  <th>From user</th>
                  <th>To user</th>
                  <th>Team change</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.changed_at).toLocaleString()}</td>
                    <td>{h.from_user_id ?? '—'}</td>
                    <td>{h.to_user_id ?? '—'}</td>
                    <td>
                      {h.from_team_id ?? '—'} → {h.to_team_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row g-2 align-items-end mb-4">
            <div className="col-auto">
              <label className="form-label">Status</label>
              <select className="form-select" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <button type="button" className="btn btn-primary" onClick={() => void applyStatus()}>
                Update status
              </button>
            </div>
          </div>
        </>
      )}

      <h3 className="mb-3">Comments</h3>
      {comments.map((c) => (
        <div key={c.id} className="border-start border-3 ps-3 mb-3">
          <div className="text-secondary small">
            {new Date(c.created_at).toLocaleString()} · author {c.author_id}
            {c.is_internal === 1 ? ' · internal' : ''}
          </div>
          <div>{c.body}</div>
        </div>
      ))}

      <form onSubmit={postComment} className="mt-4">
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="fw-medium">{internal ? 'Internal note' : 'Comment'}</span>
          <VoiceToTextButton onAppend={(t) => setComment((prev) => `${prev}${t}`)} />
        </div>
        <textarea
          className="form-control mb-2"
          rows={3}
          placeholder={internal ? 'Internal note' : 'Comment'}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {showInternal && (
          <div className="btn-list mb-2">
            <button type="button" className={`btn btn-sm ${internal ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setInternal(true)}>
              Internal
            </button>
            <button type="button" className={`btn btn-sm ${!internal ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setInternal(false)}>
              External
            </button>
          </div>
        )}
        <button type="submit" className="btn btn-outline-primary">
          Add comment
        </button>
      </form>

      {canClose && (
        <button type="button" className="btn btn-secondary mt-3" onClick={() => void closeTicket()}>
          Close ticket
        </button>
      )}
    </>
  );
}
