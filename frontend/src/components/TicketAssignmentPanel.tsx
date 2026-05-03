import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { ensureAssignmentMeta, type StaffOption, type TeamOption } from '../tickets/assignmentMetaCache';

export type { StaffOption, TeamOption };

interface Props {
  ticketId: number;
  initialTeamId: number | null;
  initialAssigneeId: number | null;
  onSaved?: () => void;
  /** Smaller controls for table / modal */
  compact?: boolean;
  /** When provided, skip fetching assignment-meta (e.g. prefetched on IT queue). */
  assignmentMeta?: { teams: TeamOption[]; staff: StaffOption[] };
}

export function TicketAssignmentPanel({
  ticketId,
  initialTeamId,
  initialAssigneeId,
  onSaved,
  compact,
  assignmentMeta: assignmentMetaProp,
}: Props) {
  const [teams, setTeams] = useState<TeamOption[]>(() => assignmentMetaProp?.teams ?? []);
  const [staff, setStaff] = useState<StaffOption[]>(() => assignmentMetaProp?.staff ?? []);
  const [teamId, setTeamId] = useState<string>(initialTeamId != null ? String(initialTeamId) : '');
  const [assigneeId, setAssigneeId] = useState<string>(initialAssigneeId != null ? String(initialAssigneeId) : '');
  const [loadingMeta, setLoadingMeta] = useState(!assignmentMetaProp);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setTeamId(initialTeamId != null ? String(initialTeamId) : '');
    setAssigneeId(initialAssigneeId != null ? String(initialAssigneeId) : '');
  }, [ticketId, initialTeamId, initialAssigneeId]);

  useEffect(() => {
    if (assignmentMetaProp) {
      setTeams(assignmentMetaProp.teams);
      setStaff(assignmentMetaProp.staff);
      setLoadingMeta(false);
      return;
    }
    let cancelled = false;
    setLoadingMeta(true);
    void ensureAssignmentMeta()
      .then((r) => {
        if (!cancelled) {
          setTeams(r.teams);
          setStaff(r.staff);
        }
      })
      .catch(() => {
        if (!cancelled) setMsg('Could not load teams or staff');
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentMetaProp]);

  const onAssigneeChange = useCallback(
    (value: string) => {
      setAssigneeId(value);
      if (!value) return;
      const sid = Number(value);
      const person = staff.find((s) => s.id === sid);
      if (person?.team_id != null) {
        setTeamId(String(person.team_id));
      }
    },
    [staff],
  );

  const save = useCallback(async () => {
    setMsg(null);
    setSaving(true);
    try {
      await api(`/tickets/${ticketId}`, {
        method: 'PATCH',
        json: {
          team_id: teamId ? Number(teamId) : null,
          assignee_id: assigneeId ? Number(assigneeId) : null,
        },
      });
      onSaved?.();
      setMsg('Saved');
      window.setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [assigneeId, onSaved, teamId, ticketId]);

  const selClass = compact ? 'form-select form-select-sm' : 'form-select';

  if (loadingMeta) {
    return <div className="text-secondary small">Loading assignment options…</div>;
  }

  return (
    <div className="row g-2 align-items-end">
      <div className={compact ? 'col-12 col-md-5' : 'col-md-5'}>
        <label className="form-label small mb-0">Team</label>
        <select className={selClass} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">— No team —</option>
          {teams.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className={compact ? 'col-12 col-md-5' : 'col-md-5'}>
        <label className="form-label small mb-0">Assign to</label>
        <select className={selClass} value={assigneeId} onChange={(e) => onAssigneeChange(e.target.value)}>
          <option value="">— Unassigned —</option>
          {staff.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
              {s.email ? ` (${s.email})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className={compact ? 'col-12 col-md-2' : 'col-md-2'}>
        <button type="button" className={compact ? 'btn btn-primary btn-sm w-100' : 'btn btn-primary w-100'} disabled={saving} onClick={() => void save()}>
          {saving ? '…' : 'Apply'}
        </button>
      </div>
      {msg && (
        <div className="col-12">
          <div className={`small ${msg === 'Saved' ? 'text-success' : 'text-danger'}`}>{msg}</div>
        </div>
      )}
      {!compact && (
        <div className="col-12">
          <p className="text-secondary small mb-0">Choosing a person sets the team to that person&apos;s team when they have one; you can change the team before applying.</p>
        </div>
      )}
    </div>
  );
}
