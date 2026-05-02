import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
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

  if (!data) return <Typography>Loading…</Typography>;

  const { ticket, comments, approvals, assignment_history: history } = data;
  const attachments = data.attachments ?? [];
  const statuses = ticket.type === 'Incident' ? incidentStatuses : srStatuses;
  const canClose =
    user?.role === 'EndUser' &&
    ((ticket.type === 'Incident' && ticket.status === 'Resolved') ||
      (ticket.type === 'ServiceRequest' && ticket.status === 'Completed'));

  const showInternal = user && (user.role === 'IT' || user.role === 'Admin');

  const pendingApproval =
    user &&
    approvals.find((a) => a.status === 'Pending' && a.approver_user_id === user.id);

  return (
    <Box>
      <Typography variant="h5">
        {ticket.ticket_number} — {ticket.title}
      </Typography>
      <Typography color="text.secondary" gutterBottom>
        {ticket.type} · {ticket.status} · {ticket.priority} · Impact {ticket.impact} / Urgency {ticket.urgency}
      </Typography>
      {ticket.type === 'ServiceRequest' && data.catalog_item?.id != null && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Catalog offering: <strong>{data.catalog_item.name ?? `Item #${data.catalog_item.id}`}</strong> (catalog ID{' '}
          {data.catalog_item.id})
        </Typography>
      )}
      {ticket.due_at && (
        <Typography variant="body2">
          SLA due: {new Date(ticket.due_at).toLocaleString()}
        </Typography>
      )}
      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1">Description</Typography>
      <Typography sx={{ mb: 2 }}>{ticket.description}</Typography>

      <Typography variant="subtitle1" gutterBottom>
        Attachments
      </Typography>
      {attachments.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No attachments yet.
        </Typography>
      )}
      {attachments.map((att) => (
        <Box key={att.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2">
            {att.original_filename} ({Math.round(att.size_bytes / 1024)} KB)
          </Typography>
          <Button size="small" onClick={() => void downloadAttachment(att)}>
            Download
          </Button>
          {(user?.role === 'IT' ||
            user?.role === 'Admin' ||
            (user?.role === 'EndUser' && ticket.requester_id === user.id)) && (
            <Button size="small" color="error" onClick={() => void removeAttachment(att)}>
              Remove
            </Button>
          )}
        </Box>
      ))}

      <Box component="form" onSubmit={uploadMoreAttachments} sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Add attachments
        </Typography>
        <AttachmentPicker files={moreFiles} onFilesChange={setMoreFiles} />
        <Button type="submit" variant="outlined" size="small" disabled={moreFiles.length === 0}>
          Upload files
        </Button>
      </Box>

      {ticket.type === 'ServiceRequest' && approvals.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Approvals</Typography>
          {approvals.map((a) => (
            <Typography key={a.id} variant="body2">
              #{a.id} — user {a.approver_user_id}: {a.status}
              {pendingApproval?.id === a.id && (
                <Stack sx={{ flexDirection: 'row', gap: 1, mt: 1 }}>
                  <Button size="small" variant="contained" onClick={() => void decideApproval(a.id, 'Approved')}>
                    Approve
                  </Button>
                  <Button size="small" color="error" onClick={() => void decideApproval(a.id, 'Rejected')}>
                    Reject
                  </Button>
                </Stack>
              )}
            </Typography>
          ))}
          {pendingApproval && (
            <TextField
              label="Approval comment"
              fullWidth
              size="small"
              sx={{ mt: 1 }}
              value={approverComment}
              onChange={(e) => setApproverComment(e.target.value)}
            />
          )}
        </Box>
      )}

      {showInternal && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Assignment history</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>From user</TableCell>
                <TableCell>To user</TableCell>
                <TableCell>Team change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{new Date(h.changed_at).toLocaleString()}</TableCell>
                  <TableCell>{h.from_user_id ?? '—'}</TableCell>
                  <TableCell>{h.to_user_id ?? '—'}</TableCell>
                  <TableCell>
                    {h.from_team_id ?? '—'} → {h.to_team_id ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {showInternal && (
        <Stack sx={{ flexDirection: 'row', gap: 2, alignItems: 'center', mb: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
              {statuses.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={() => void applyStatus()}>
            Update status
          </Button>
        </Stack>
      )}

      <Typography variant="subtitle1">Comments</Typography>
      {comments.map((c) => (
        <Box key={c.id} sx={{ borderLeft: '3px solid #ccc', pl: 1, mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {new Date(c.created_at).toLocaleString()} · author {c.author_id}
            {c.is_internal === 1 ? ' · internal' : ''}
          </Typography>
          <Typography variant="body2">{c.body}</Typography>
        </Box>
      ))}

      <Box component="form" onSubmit={postComment} sx={{ mt: 2 }}>
        <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2">{internal ? 'Internal note' : 'Comment'}</Typography>
          <VoiceToTextButton onAppend={(t) => setComment((prev) => `${prev}${t}`)} />
        </Stack>
        <TextField
          label={internal ? 'Internal note' : 'Comment'}
          fullWidth
          multiline
          minRows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {showInternal && (
          <Stack sx={{ flexDirection: 'row', gap: 2, mt: 1 }}>
            <Button size="small" variant={internal ? 'contained' : 'outlined'} onClick={() => setInternal(true)}>
              Internal
            </Button>
            <Button size="small" variant={!internal ? 'contained' : 'outlined'} onClick={() => setInternal(false)}>
              External
            </Button>
          </Stack>
        )}
        <Button type="submit" sx={{ mt: 2 }}>
          Add comment
        </Button>
      </Box>

      {canClose && (
        <Button sx={{ mt: 2 }} variant="contained" color="secondary" onClick={() => void closeTicket()}>
          Close ticket
        </Button>
      )}
    </Box>
  );
}
