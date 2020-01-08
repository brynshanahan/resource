import React, { useMemo } from "react";
import { useField } from "./Page";
import { defineBlock } from "./define-block";

const containsRecursion = /r.*?e.*?c.*?u.*s.*i.*?o.*?n/;

export const Input = defineBlock({
  range: "default",
  name: "input"
})(({ bind, placeholder }) => {
  const [value, setName] = useField("value", "");
  const recurses = useMemo(() => value && containsRecursion.test(value), [
    value
  ]);

  return (
    <span {...bind}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={e => setName(e.target.value)}
      />
      {recurses && (
        <div>
          <br />
          <Input scope="inner" placeholder={placeholder} />
          <br />
        </div>
      )}
    </span>
  );
});
