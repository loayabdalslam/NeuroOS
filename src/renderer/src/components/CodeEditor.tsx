import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

const themeCompartment = new Compartment();
const languageCompartment = new Compartment();

function languageExtension(language: string) {
  switch (language) {
    case 'typescript':
      return javascript({ typescript: true, jsx: true });
    case 'javascript':
      return javascript({ jsx: true });
    case 'json':
      return json();
    case 'python':
      return python();
    case 'markdown':
      return markdown();
    case 'html':
      return html();
    case 'css':
    case 'scss':
      return css();
    default:
      return [];
  }
}

const lightTheme = EditorView.theme({
  '&': { color: '#15171b', backgroundColor: 'transparent' },
  '.cm-content': { caretColor: '#4176e6' },
  '.cm-gutters': { backgroundColor: 'transparent', color: '#9aa1a9', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(15,23,42,0.035)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(15,23,42,0.05)', color: '#41474e' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(65,118,230,0.18) !important' },
});

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.8px' },
  '.cm-scroller': {
    fontFamily: 'var(--n-font-mono)',
    lineHeight: '1.65',
    overflow: 'auto',
  },
  '.cm-content': { padding: '14px 0' },
  '.cm-gutters': { paddingRight: '6px', fontSize: '11px' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '34px' },
  '.cm-foldGutter': { width: '14px' },
  '&.cm-focused': { outline: 'none' },
});

export function CodeEditor({
  value,
  language,
  theme,
  onChange,
  onSave,
  readOnly = false,
}: {
  value: string;
  language: string;
  theme: 'dark' | 'light';
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const lastValue = useRef(value);
  const changeRef = useRef(onChange);
  const saveRef = useRef(onSave);
  changeRef.current = onChange;
  saveRef.current = onSave;

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        baseTheme,
        themeCompartment.of(theme === 'dark' ? oneDark : lightTheme),
        languageCompartment.of(languageExtension(language)),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const doc = update.state.doc.toString();
          lastValue.current = doc;
          changeRef.current(doc);
        }),
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              saveRef.current?.();
              return true;
            },
          },
        ]),
        EditorState.readOnly.of(readOnly),
      ],
    });
    const editor = new EditorView({ state, parent: host.current });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // Editor is created once per file; language/theme are reconfigured below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: themeCompartment.reconfigure(theme === 'dark' ? oneDark : lightTheme) });
  }, [theme]);

  useEffect(() => {
    view.current?.dispatch({ effects: languageCompartment.reconfigure(languageExtension(language)) });
  }, [language]);

  useEffect(() => {
    if (!view.current) return;
    if (value === lastValue.current) return;
    lastValue.current = value;
    view.current.dispatch({ changes: { from: 0, to: view.current.state.doc.length, insert: value } });
  }, [value]);

  return <div className="codeeditor" ref={host} />;
}
