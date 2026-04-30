'use client';

import { Editor } from '@monaco-editor/react';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export default function CodeEditor({ value, onChange }: Props) {
  return (
    <Editor
      height="100%"
      defaultLanguage="html"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        tabSize: 2,
        formatOnPaste: true,
        automaticLayout: true,
      }}
    />
  );
}
