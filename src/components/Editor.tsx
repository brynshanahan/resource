import React from "react";
import { createEditor } from "slate";
import { Slate, Editable, withReact } from "slate-react";
import { defineBlock } from "./define-block";
import { useMemo } from "react";
import { useField } from "./Page";

const defaultValue = [
  {
    type: "paragraph",
    children: [
      {
        text: "A line of text in a paragraph that you can edit!"
      }
    ]
  },
  {
    type: "paragraph",
    children: [
      {
        text: "Only unstyled text is implemented at the moment!"
      }
    ]
  }
];

export const Editor = defineBlock({ name: "Editor" })(() => {
  const editor = useMemo(() => withReact(createEditor()), []);
  const [value, setValue] = useField("editor", defaultValue);

  return (
    <Slate onChange={value => setValue(value)} value={value} editor={editor}>
      <Editable />
    </Slate>
  );
});
