import { useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import { sanitizePastedTaskDescriptionHtml, sanitizeTaskDescriptionHtml, taskDescriptionToHtml } from '../../utils/taskDescription'

const extensions = [
  StarterKit.configure({ link: false, underline: false }),
  Underline,
  Link.configure({ openOnClick: false }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({
    resizable: false,
    renderWrapper: true,
    HTMLAttributes: { class: 'task-description-table' },
  }),
  TableRow,
  TableHeader,
  TableCell,
]

function ToolbarButton({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded text-ink-2 transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-brand-50 text-brand-700' : ''}`}
    >
      {children}
    </button>
  )
}

function RichTextToolbar({ editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor.isActive('bold'),
      italic: currentEditor.isActive('italic'),
      underline: currentEditor.isActive('underline'),
      strike: currentEditor.isActive('strike'),
      heading1: currentEditor.isActive('heading', { level: 1 }),
      heading2: currentEditor.isActive('heading', { level: 2 }),
      bulletList: currentEditor.isActive('bulletList'),
      orderedList: currentEditor.isActive('orderedList'),
      alignCenter: currentEditor.isActive({ textAlign: 'center' }),
      alignRight: currentEditor.isActive({ textAlign: 'right' }),
      inTable: currentEditor.isActive('table'),
      canUndo: currentEditor.can().undo(),
      canRedo: currentEditor.can().redo(),
      canAddRow: currentEditor.can().addRowAfter(),
      canAddRowBefore: currentEditor.can().addRowBefore(),
      canAddColumn: currentEditor.can().addColumnAfter(),
      canAddColumnBefore: currentEditor.can().addColumnBefore(),
    }),
  })

  if (!state) return null

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter a link URL', previousUrl || 'https://')
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: url.trim() }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface px-2 py-1.5">
      <div className="flex items-center gap-0.5 border-r border-line pr-1">
        <ToolbarButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarButton>
      </div>
      <div className="flex items-center gap-0.5 border-r border-line pr-1">
        <ToolbarButton label="Heading 1" active={state.heading1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Heading 2" active={state.heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Bulleted list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Numbered list" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarButton>
      </div>
      <div className="flex items-center gap-0.5 border-r border-line pr-1">
        <ToolbarButton label="Align left" active={!state.alignCenter && !state.alignRight} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Align center" active={state.alignCenter} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Align right" active={state.alignRight} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Add or remove link" onClick={setLink}><LinkIcon className="h-4 w-4" /></ToolbarButton>
      </div>
      <div className="flex items-center gap-0.5 border-r border-line pr-1">
        <ToolbarButton label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></ToolbarButton>
        {state.inTable && (
          <>
            <ToolbarButton label="Add row above" disabled={!state.canAddRowBefore} onClick={() => editor.chain().focus().addRowBefore().run()}><span className="text-xs font-semibold">R+</span></ToolbarButton>
            <ToolbarButton label="Add row below" disabled={!state.canAddRow} onClick={() => editor.chain().focus().addRowAfter().run()}><span className="text-xs font-semibold">R-</span></ToolbarButton>
            <ToolbarButton label="Add column before" disabled={!state.canAddColumnBefore} onClick={() => editor.chain().focus().addColumnBefore().run()}><span className="text-xs font-semibold">C-</span></ToolbarButton>
            <ToolbarButton label="Add column after" disabled={!state.canAddColumn} onClick={() => editor.chain().focus().addColumnAfter().run()}><span className="text-xs font-semibold">C+</span></ToolbarButton>
            <ToolbarButton label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}><span className="text-xs font-semibold">-R</span></ToolbarButton>
            <ToolbarButton label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}><span className="text-xs font-semibold">-C</span></ToolbarButton>
            <ToolbarButton label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}><span className="text-xs font-semibold">Del</span></ToolbarButton>
          </>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        <ToolbarButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolbarButton>
      </div>
    </div>
  )
}

export default function RichTextEditor({ id, value, onChange }) {
  const [initialContent] = useState(() => taskDescriptionToHtml(value))
  const editor = useEditor({
    extensions,
    content: initialContent,
    editorProps: {
      attributes: {
        id,
        class: 'min-h-28 p-3 text-[13px] leading-6 text-ink outline-none',
        'aria-label': 'Task description rich text editor',
        'aria-multiline': 'true',
      },
      transformPastedHTML: sanitizePastedTaskDescriptionHtml,
    },
    onUpdate: ({ editor: updatedEditor }) => onChange(sanitizeTaskDescriptionHtml(updatedEditor.getHTML())),
  })

  if (!editor) return null

  return (
    <div className="task-rich-editor overflow-hidden rounded-md border border-line bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
      <RichTextToolbar editor={editor} />
      <div className="max-h-80 overflow-auto">
        <EditorContent editor={editor} />
      </div>
      <p className="border-t border-line-soft bg-surface px-3 py-1.5 text-[10px] text-muted">
        Paste formatted content or a table. Plain-text clipboard data is inserted as text.
      </p>
    </div>
  )
}
