import React from "react";
import {
  ContentStore,
  ScopeStore,
  UpdaterStore,
  withRootContentValue,
  useFieldName,
  useRootUpdater,
  withContentValue,
  useUpdater,
  useSep
} from "./Page";

interface BlockBindings {
  onMouseEnter(e): void;
  onMouseLeave(e): void;
  onClick(e): void;
}

interface BlockDefinition {
  name: string;
  scope?: "default" | "children" | "self";
  visible?: boolean | { [key: string]: boolean } | ((args: any[]) => boolean);
  interaction?:
    | boolean
    | {
        focus: boolean;
      };
}

interface BlockState {
  type: string;
  data: {
    [k: string]: any;
  };
}

interface BlockProps {
  bind: BlockBindings;
}

function getInitialBlockValue(name: string): BlockState {
  return {
    type: name,
    data: {}
  };
}

export function defineBlock({ name, scope = "default" }: BlockDefinition) {
  /* defineBlock is a curried function. So you call defineBlock(options)(component) */
  const contentPicker =
    scope === "default" ? withContentValue : withRootContentValue;
  const useUpdaterHook = scope === "default" ? useUpdater : useRootUpdater;

  return function<
    T extends React.FC<BlockProps> | React.ComponentClass<BlockProps>
  >(BlockComponent: T) {
    const Block = contentPicker(props => {
      const { field, value, ...rest } = props;

      const updater = useUpdaterHook();
      const sep = useSep();
      const innerField = useFieldName(field);
      const pickScope = scope === "default" ? field : innerField;

      const state: BlockState = value || getInitialBlockValue(name);

      /* Bind some events to the block element so we can record focus */
      const bindings: BlockBindings = React.useMemo(() => {
        return {
          onMouseEnter: e => {
            // Add cms focus
          },
          onMouseLeave: e => {
            // Remove cms focus
          },
          onClick: e => {
            // Add cms focus
          }
        };
      }, []);

      const updateBlockState = React.useCallback(
        valueCreator => {
          updater(draft => {
            const state = draft[pickScope];
            if (!state) {
              /* Create the initial value */
              const newBlockState = getInitialBlockValue(name);
              valueCreator(newBlockState.data);

              draft[pickScope] = newBlockState;
            } else {
              /* Update the previous value */
              valueCreator(state.data);
            }
          });
        },
        [updater, pickScope]
      );

      return (
        <ScopeStore.Provider value={field + sep + "data"}>
          <UpdaterStore.Provider value={updateBlockState}>
            <ContentStore.Provider value={state.data}>
              <BlockComponent {...rest} bind={bindings} />
            </ContentStore.Provider>
          </UpdaterStore.Provider>
        </ScopeStore.Provider>
      );
    });
    Block.displayName = "Block_" + name;
    return Block;
  };
}
