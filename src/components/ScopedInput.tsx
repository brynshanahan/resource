import React from "react";
import { useField } from "./Page";
import { defineBlock } from "./define-block";

const containsRecursion = /r.*?e.*?c.*?u.*s.*i.*?o.*?n/;

export const ScopedInput = defineBlock({
  name: "input"
})(({ bind }) => {
  const [value, setName] = useField("value", "");

  return (
    <span {...bind}>
      <input value={value} onChange={e => setName(e.target.value)} />
      {value && containsRecursion.test(value) && (
        <div>
          <br />
          <ScopedInput scope="inner" />
          <br />
        </div>
      )}
    </span>
  );
});
