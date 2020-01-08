import React, { memo, useState, useEffect } from "react";
import styled from "styled-components";
import { ObjectInspector } from "react-inspector";

function useDebounce(val, time) {
  const [value, setValue] = useState(val);
  useEffect(() => {
    const tm = setTimeout(() => setValue(val), time);
    return () => clearTimeout(tm);
  }, [time, val]);
  return value;
}

const debouncize = (propName: string, time) => Component => {
  const Comp = memo(Component);
  return ({ [propName]: val, ...rest }) => {
    const value = useDebounce(val, time);
    const innerProps = { value, ...rest };
    return <Comp {...innerProps} />;
  };
};

export const Print = debouncize("value", 900)(({ value }) => {
  return (
    <PrintContainer>
      <div>
        <button onClick={() => console.log(value)}>console.log</button>
      </div>
      <ObjectInspector data={value} />
    </PrintContainer>
  );
});

const PrintContainer = styled.div``;
