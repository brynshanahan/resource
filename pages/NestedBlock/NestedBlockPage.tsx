import React from "react";
import { Print } from "../../src/components/Print";
import { Page, useField, useSubscribeToPageStore } from "../../src/components/Page";
import { Input } from "../../src/components/Input";

import Canvas from "../../src/components/Canvas";
import { defineBlock } from "../../src/components/define-block";
import styled from "styled-components";

import { Editor } from "../../src/components/Editor";

const NumberField = () => {
  const [number, setNumber] = useField("number", 0);
  return (
    <div>
      <span>{number}</span>
      <button onClick={() => setNumber(number + 1)}>+</button>
    </div>
  );
};

const PageContent = defineBlock({ name: "document" })(({ children }) => {
  return <>{children}</>;
});

const DebugPage = ({ path }) => {
  const value = useSubscribeToPageStore(path);
  return <Print value={value} />;
};

const Test = defineBlock({ name: "ScopedTest", scope: "children" })(
  ({ children }) => {
    const [val, setVal] = useField("testField");
    return (
      <>
        <span onClick={e => setVal(val => val + 1 || 1)}>next {val}</span>
        {children}
      </>
    );
  }
);

export const NestedBlockPage = () => {
  return (
    <Page path={window.location.href}>
      <PageContent field="root">
        <div>
          Nested blocks bubble up changes to the root of the page calling each
          onChange callback on the way (I think)
        </div>
        <DebugPage path={window.location.href} />
        <PageContentSpacing>
          <Test field="test" />
          <NumberField />
          <Canvas field="drawing" />
          <Input field="title" placeholder="Type recursion" />
          <Editor field="page-summary" />
        </PageContentSpacing>
      </PageContent>
    </Page>
  );
};

const PageContentSpacing = styled.div`
  & > * {
    margin-bottom: 10px;
  }
`;
