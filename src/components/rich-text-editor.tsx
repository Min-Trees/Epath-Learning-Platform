"use client";

import { useState, useEffect } from "react";
import { Editor } from "@tinymce/tinymce-react";

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
    <div
      className={`rounded-md border ${className}`}
      style={{ direction: "ltr", textAlign: "left" }}
    >
      <Editor
        licenseKey="gpl"
        initialValue={value}
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        onInit={(_evt, editor) => {
          const body = editor.getBody();
          if (body) {
            body.setAttribute("dir", "ltr");
            body.style.direction = "ltr";
            body.style.textAlign = "left";
          }
          const doc = editor.getDoc();
          if (doc && doc.body) {
            doc.body.setAttribute("dir", "ltr");
            doc.body.style.direction = "ltr";
            doc.body.style.textAlign = "left";
          }
        }}
        init={{
          base_url: "/tinymce",
          suffix: ".min",
          height: 400,
          menubar: false,
          branding: false,
          statusbar: false,
          placeholder,
          plugins: [
            "lists", "link", "code", "wordcount",
          ],
          toolbar:
            "undo redo | formatselect | bold italic underline | \
            bullist numlist | \
            removeformat",
          content_style: `
            body, .mce-content-body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
              font-size: 14px !important;
              line-height: 1.6 !important;
              padding: 12px !important;
              direction: ltr !important;
              text-align: left !important;
              unicode-bidi: normal !important;
            }
            p, h1, h2, h3, h4, h5, h6, div, span, ul, ol, li, blockquote {
              direction: ltr !important;
              text-align: left !important;
              unicode-bidi: normal !important;
            }
          `,
          link_list: [],
          link_title: false,
          target_list: [],
        }}
        onEditorChange={onChange}
      />
    </div>
  );
}
