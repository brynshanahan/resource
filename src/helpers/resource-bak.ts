import produce, { applyPatches, Patch } from "immer";
import uuid from "uuid/v4";

interface PendingAction {
  id: string;
  recipe: (draft: any) => void;
  patches: Patch[];
}

const patchContainer = Symbol("resource_history");

class Server {
  static propose(element, change): string {
    return "";
  }
  static nextAction(): PendingAction {
    return {};
  }
}

class Patchable {
  confirmedState: any;
  state: any;
  [patchContainer]: {
    pending: PendingAction[];
    paused: boolean | Promise<any>;
  } = {
    pending: [],
    paused: false
  };

  propose(recipe: (draft: any) => void) {
    const id = uuid();
    let patches!: Patch[];

    this.state = produce(this.state, recipe, p => {
      patches = p;
    });

    this[patchContainer].pending.push({
      id,
      recipe,
      patches
    });
  }

  async distributeFirstChange() {
    const change = this[patchContainer].pending[0];
    const response = await Server.propose(this, {
      base: this.confirmedState.id,
      patches: change.patches,
      changeVersion: change.id
    });
    if (response !== "CONFIRMED") {
      let resolver;
      const paused = new Promise(resolve => {
        resolver = resolve;
      });
      this[patchContainer].paused = paused;
      paused.then(() => {
        if (this[patchContainer].paused === paused) {
          this[patchContainer].paused = false;
        }
      });

      let action;
      do {
        action = await Server.nextAction();
      } while (action.id !== response);
    }
  }
}

class Resource extends Patchable {
  confirmedState!: {
    id: string;
    type: string;
    resources: {
      [id: string]: Resource;
    };
    data: {
      [field: string]: any;
    };

    meta: {
      edit: number;
      created: Date;
      createdBy: UserResource;
      lastEditted: Date;
      lastEdittedBy: UserResource;
    };
  };
  state: any;

  static operation: {
    op: "add" | "remove" | "replace";
    path: string[];
    value: any;
    version: number;
    user: UserResource["id"];
  };

  apply(operation: (typeof Resource)["operation"]) {
    switch (operation.op) {
      default:
        applyPatches(this, [operation as Patch]);
    }
  }

  history(direction) {}
}

class UserResource extends Resource {}
