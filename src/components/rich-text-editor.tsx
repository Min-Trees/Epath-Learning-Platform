"use client";

import { Editor } from "@tinymce/tinymce-react";
import { useState, useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung...",
  className = "",
}: RichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className={`rounded-md border ${className}`}>
        <div className="h-[400px] flex items-center justify-center bg-gray-50 text-gray-400">
          Đang tải trình soạn thảo...
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-md border ${className}`}>
      <Editor
        licenseKey="gpl"
        initialValue={value}
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        init={{
          height: 400,
          menubar: true,
          branding: false,
          statusbar: false,
          placeholder,
          plugins: [
            "advlist", "autolink", "lists", "link", "image", "charmap",
            "anchor", "searchreplace", "visualblocks", "code", "fullscreen",
            "insertdatetime", "media", "table", "help", "wordcount",
          ],
          toolbar:
            "undo redo | formatselect | bold italic underline strikethrough | \
            alignleft aligncenter alignright alignjustify | \
            bullist numlist outdent indent | \
            blockquote link | \
            removeformat | help",
          content_style: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              padding: 12px;
            }
            h2 { font-size: 1.5em; margin-top: 1em; }
            h3 { font-size: 1.25em; margin-top: 0.8em; }
            p { margin-bottom: 0.5em; }
            blockquote {
              border-left: 3px solid #ccc;
              padding-left: 1em;
              margin-left: 0;
              color: #666;
            }
          `,
          link_list: [],
          link_title: false,
          target_list: [
            { title: "New window", value: "_blank" },
            { title: "Same window", value: "_self" },
          ],
        }}
        onEditorChange={onChange}
      />
    </div>
  );
}
