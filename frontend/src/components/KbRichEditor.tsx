import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';

export type KbRichEditorHandle = {
  insertImage: (src: string) => void;
};

interface Props {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export const KbRichEditor = forwardRef<KbRichEditorHandle, Props>(function KbRichEditor(
  { valueHtml, onChangeHtml, placeholder = 'Paste from Word or type here…', editable = true },
  ref,
) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: valueHtml || '<p></p>',
    editable,
    editorProps: {
      attributes: {
        class: 'kb-rich-editor-prose',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChangeHtml(ed.getHTML());
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      insertImage: (src: string) => {
        editor?.chain().focus().setImage({ src }).run();
      },
    }),
    [editor],
  );

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((valueHtml || '<p></p>') !== current) {
      editor.commands.setContent(valueHtml || '<p></p>', { emitUpdate: false });
    }
  }, [editor, valueHtml]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return <div className="text-secondary py-4">Loading editor…</div>;

  return (
    <div className="kb-rich-editor border rounded">
      <div className="btn-toolbar flex-wrap gap-1 p-2 border-bottom bg-body-secondary align-items-center" role="toolbar">
        <div className="btn-group btn-group-sm">
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
            <strong>B</strong>
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
            <em>I</em>
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
            <u>U</u>
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
            <s>S</s>
          </button>
        </div>
        <div className="btn-group btn-group-sm">
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            H3
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().setParagraph().run()}>
            P
          </button>
        </div>
        <div className="btn-group btn-group-sm">
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().toggleBulletList().run()}>
            • List
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            1. List
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            “ Quote
          </button>
        </div>
        <div className="btn-group btn-group-sm">
          <button type="button" className="btn btn-outline-secondary" onClick={setLink}>
            Link
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().unsetLink().run()}>
            Unlink
          </button>
        </div>
        <div className="btn-group btn-group-sm">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            Table
          </button>
        </div>
        <div className="btn-group btn-group-sm">
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().undo().run()}>
            Undo
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => editor.chain().focus().redo().run()}>
            Redo
          </button>
        </div>
      </div>
      <EditorContent editor={editor} className="kb-rich-editor-content p-3" />
    </div>
  );
});
