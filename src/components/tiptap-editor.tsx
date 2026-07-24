"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { cn } from "@/utils";
import { ImageIcon, LinkIcon, Clipboard } from "lucide-react";

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TiptapEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung...",
  className = "",
}: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [showPasteMenu, setShowPasteMenu] = useState(false);
  const [pastePosition, setPastePosition] = useState({ x: 0, y: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[400px] px-4 py-3",
        style: "direction: ltr; text-align: left;",
      },
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // Check for image first
        const items = clipboardData.items;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              handleImageFile(file);
              return true;
            }
          }
        }

        // Check for HTML content (rich text)
        const html = clipboardData.getData("text/html");
        if (html) {
          event.preventDefault();
          
          // Show paste options
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setPastePosition({
              x: rect.left + window.scrollX,
              y: rect.bottom + window.scrollY + 8,
            });
          }
          
          // Store HTML for paste
          (view as any)._pendingPasteHtml = html;
          setShowPasteMenu(true);
          return true;
        }

        // Plain text fallback
        const text = clipboardData.getData("text/plain");
        if (text) {
          event.preventDefault();
          editor?.commands.insertContent(text);
          return true;
        }

        return false;
      },
      handleDrop: (view, event) => {
        const dataTransfer = event.dataTransfer;
        if (!dataTransfer) return false;

        const files = dataTransfer.files;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            handleImageFile(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const handleImageFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (editor && base64) {
        editor.chain().focus().setImage({ src: base64 }).run();
      }
    };
    reader.readAsDataURL(file);
  }, [editor]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageFile(file);
    }
    e.target.value = "";
  }, [handleImageFile]);

  const handleAddLink = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      linkInputRef.current?.blur();
    }
  }, [linkUrl, editor]);

  const handleRemoveLink = useCallback(() => {
    if (editor) {
      editor.chain().focus().unsetLink().run();
    }
  }, [editor]);

  const handlePasteHtml = useCallback((html: string) => {
    if (editor) {
      // Parse HTML and insert as Tiptap nodes
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      
      // Create a temporary container
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      
      // Insert HTML content
      editor.chain().focus().insertContent(tempDiv.innerHTML).run();
    }
    setShowPasteMenu(false);
  }, [editor]);

  const handlePasteText = useCallback((text: string) => {
    if (editor) {
      editor.chain().focus().insertContent(text).run();
    }
    setShowPasteMenu(false);
  }, [editor]);

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Handle paste menu click outside
  useEffect(() => {
    const handleClickOutside = () => setShowPasteMenu(false);
    if (showPasteMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showPasteMenu]);

  if (!editor) {
    return (
      <div className={cn("rounded-md border", className)}>
        <div className="h-[400px] flex items-center justify-center bg-gray-50 text-gray-400">
          Đang tải trình soạn thảo...
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border overflow-hidden", className)}>
      <div className="bg-muted/50 border-b p-2 flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("bold") && "bg-muted"
          )}
          title="Bold (Ctrl+B)"
        >
          <span className="font-bold text-sm">B</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("italic") && "bg-muted"
          )}
          title="Italic (Ctrl+I)"
        >
          <span className="italic text-sm">I</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("strike") && "bg-muted"
          )}
          title="Strikethrough"
        >
          <span className="line-through text-sm">S</span>
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("heading", { level: 1 }) && "bg-muted"
          )}
          title="Heading 1"
        >
          <span className="text-sm font-bold">H1</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("heading", { level: 2 }) && "bg-muted"
          )}
          title="Heading 2"
        >
          <span className="text-sm font-bold">H2</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("heading", { level: 3 }) && "bg-muted"
          )}
          title="Heading 3"
        >
          <span className="text-sm font-bold">H3</span>
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("bulletList") && "bg-muted"
          )}
          title="Bullet List"
        >
          <span className="text-sm">• List</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("orderedList") && "bg-muted"
          )}
          title="Numbered List"
        >
          <span className="text-sm">1. List</span>
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("blockquote") && "bg-muted"
          )}
          title="Quote"
        >
          <span className="text-sm">❝</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={cn(
            "p-2 rounded hover:bg-muted transition-colors",
            editor.isActive("codeBlock") && "bg-muted"
          )}
          title="Code Block"
        >
          <span className="text-sm font-mono">&lt;/&gt;</span>
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded hover:bg-muted transition-colors"
          title="Insert Image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => linkInputRef.current?.focus()}
            className={cn(
              "p-2 rounded hover:bg-muted transition-colors",
              editor.isActive("link") && "bg-muted"
            )}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
          {editor.isActive("link") && (
            <button
              type="button"
              onClick={handleRemoveLink}
              className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center"
              title="Remove Link"
            >
              ×
            </button>
          )}
        </div>
        <div className="w-px h-6 bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 rounded hover:bg-muted transition-colors disabled:opacity-50"
          title="Undo (Ctrl+Z)"
        >
          <span className="text-sm">↩</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded hover:bg-muted transition-colors disabled:opacity-50"
          title="Redo (Ctrl+Y)"
        >
          <span className="text-sm">↪</span>
        </button>
      </div>

      <div className="relative">
        {editor.isActive("link") && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-background border rounded-md p-2 shadow-md">
            <input
              ref={linkInputRef}
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLink();
                }
                if (e.key === "Escape") {
                  setLinkUrl("");
                  linkInputRef.current?.blur();
                }
              }}
              className="flex-1 min-w-[200px] px-2 py-1 text-sm border rounded"
            />
            <button
              type="button"
              onClick={handleAddLink}
              className="px-2 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              OK
            </button>
          </div>
        )}
        
        {/* Paste options menu */}
        {showPasteMenu && (
          <div
            className="fixed z-50 bg-background border rounded-lg shadow-lg p-2 min-w-[200px]"
            style={{ left: pastePosition.x, top: pastePosition.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium mb-2 px-2">Dán nội dung:</p>
            <button
              type="button"
              onClick={() => {
                const view = (editor as any).view;
                if (view?._pendingPasteHtml) {
                  handlePasteHtml(view._pendingPasteHtml);
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted transition-colors text-left"
            >
              <Clipboard className="h-4 w-4" />
              <span>Giữ định dạng</span>
              <span className="text-xs text-muted-foreground ml-auto">(Word, Web)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const text = navigator.clipboard.readText();
                text.then(t => handlePasteText(t));
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted transition-colors text-left"
            >
              <span className="font-mono text-xs">T</span>
              <span>Chỉ văn bản</span>
              <span className="text-xs text-muted-foreground ml-auto">(Plain text)</span>
            </button>
          </div>
        )}
        
        <EditorContent
          editor={editor}
          className="min-h-[400px]"
          style={{ direction: "ltr", textAlign: "left" }}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
