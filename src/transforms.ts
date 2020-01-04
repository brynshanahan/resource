import {
  Operation,
  Path,
  InsertNodeOperation,
  InsertTextOperation,
  MergeNodeOperation,
  RemoveTextOperation
} from "slate";
import produce from "immer";
/*                                car: Operation{add a}     and Operation{add n}                 */
export default function transform(next: Operation, current: Operation) {
  const targetTransforms = transforms[next.type];
  const individualTransform = targetTransforms[current.type];

  if (!individualTransform) {
    console.warn(
      `Transform for next${next.type} by current:${current.type} does not exist`
    );
    return next;
  }

  return produce(next, draft => individualTransform(draft, current));
}

/* {
  merge_node:undefined,
  insert_node:undefined,
  remove_node:undefined,
  move_node:undefined,
  insert_text:undefined,
  remove_text:undefined,
  set_node:undefined,
  set_selection:undefined,
  merge_node:undefined,
  split_node: undefined
} */

const transforms = {
  merge_node: {
    merge_node: undefined,
    insert_node: undefined,
    remove_node: undefined,
    move_node: undefined,
    insert_text: undefined,
    remove_text: undefined,
    set_node: undefined,
    set_selection: undefined,
    split_node: undefined
  },
  insert_node: {
    insert_node: (
      next: InsertNodeOperation,
      current: InsertNodeOperation
    ) => {},
    merge_node: (next: InsertNodeOperation, current: MergeNodeOperation) => {},
    remove_node: undefined,
    move_node: undefined,
    insert_text: undefined,
    remove_text: undefined,
    set_node: undefined,
    set_selection: undefined,
    split_node: undefined
  },
  remove_node: {
    merge_node: undefined,
    insert_node: undefined,
    remove_node: undefined,
    move_node: undefined,
    insert_text: undefined,
    remove_text: undefined,
    set_node: undefined,
    set_selection: undefined,
    split_node: undefined
  },
  move_node: {
    merge_node: undefined,
    insert_node: undefined,
    remove_node: undefined,
    move_node: undefined,
    insert_text: undefined,
    remove_text: undefined,
    set_node: undefined,
    set_selection: undefined,
    split_node: undefined
  },
  insert_text: {
    merge_node: undefined,
    insert_node: undefined,
    remove_node: undefined,
    move_node: undefined,
    insert_text: (next: InsertTextOperation, current: InsertTextOperation) => {
      if (Path.equals(next.path, current.path)) {
        /* The position has moved up by this much */
        next.offset += current.text.length;
      }
    },
    remove_text: (next: InsertTextOperation, current: RemoveTextOperation) => {
      if (Path.equals(next.path, current.path)) {
        console.log({ removal: current });
        next.offset -= current.text.length;
      }
    },
    set_node: undefined,
    set_selection: undefined,
    split_node: undefined
  },
  remove_text: {
    merge_node: undefined,
    insert_node: undefined,
    remove_node: undefined,
    move_node: undefined,
    insert_text: (next: RemoveTextOperation, current: InsertTextOperation) => {
      if (Path.equals(next.path, current.path)) {
        next.offset += current.length;
      }
    },
    remove_text: (next: InsertTextOperation, current: RemoveTextOperation) => {
      if (Path.equals(next.path, current.path)) {
        next.offset -= current.text.length;
      }
    },
    set_node: undefined,
    set_selection: undefined,
    split_node: undefined
  },
  set_node: {
    merge_node: undefined,
    insert_node: undefined,
    remove_node: undefined,
    move_node: undefined,
    insert_text: undefined,
    remove_text: undefined,
    set_node: undefined,
    set_selection: undefined,
    split_node: undefined
  },
  split_node: {
    merge_node: undefined,
    insert_node: undefined,
    remove_node: undefined,
    move_node: undefined,
    insert_text: undefined,
    remove_text: undefined,
    set_node: undefined,
    set_selection: undefined,
    split_node: undefined
  }
};
