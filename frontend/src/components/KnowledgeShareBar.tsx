import { useCallback, useMemo, useState } from 'react';
import { IconBrandTeams, IconCopy, IconMail, IconBookmark, IconBookmarkFilled } from '@tabler/icons-react';
import { isArticleSaved, toggleSavedArticle } from '../knowledge/kbSavedStorage';

function articlePublicUrl(articleId: number): string {
  const path = `/knowledge/${articleId}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

function teamsShareUrl(pageUrl: string, title: string): string {
  const msg = `${title}\n${pageUrl}`;
  return `https://teams.microsoft.com/l/chat/0/0?users=&topicName=&message=${encodeURIComponent(msg)}`;
}

function mailtoShareUrl(pageUrl: string, title: string): string {
  const subject = encodeURIComponent(`Knowledge: ${title}`);
  const body = encodeURIComponent(`I thought you might find this helpful:\n\n${title}\n${pageUrl}\n`);
  return `mailto:?subject=${subject}&body=${body}`;
}

interface Props {
  articleId: number;
  title: string;
}

export function KnowledgeShareBar({ articleId, title }: Props) {
  const pageUrl = useMemo(() => articlePublicUrl(articleId), [articleId]);
  const [saved, setSaved] = useState(() => isArticleSaved(articleId));
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(pageUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [pageUrl]);

  const onSave = useCallback(() => {
    setSaved(toggleSavedArticle(articleId));
  }, [articleId]);

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
      <span className="text-secondary small me-1">Share</span>
      <a className="btn btn-sm btn-outline-primary" href={mailtoShareUrl(pageUrl, title)}>
        <IconMail size={18} className="me-1" aria-hidden />
        Email
      </a>
      <a
        className="btn btn-sm btn-outline-primary"
        href={teamsShareUrl(pageUrl, title)}
        target="_blank"
        rel="noopener noreferrer"
        title="Opens Microsoft Teams with a draft message containing the link"
      >
        <IconBrandTeams size={18} className="me-1" aria-hidden />
        Microsoft Teams
      </a>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCopy}>
        <IconCopy size={18} className="me-1" aria-hidden />
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <button type="button" className={`btn btn-sm ${saved ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={onSave}>
        {saved ? <IconBookmarkFilled size={18} className="me-1" aria-hidden /> : <IconBookmark size={18} className="me-1" aria-hidden />}
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
