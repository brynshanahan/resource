export type PathString = string;
export type PathPart = string | number;

/* Only checks for a positive number string, doesn't check for hexa */
const IS_NUMERIC_KEY = /^\d+$/;

function isNumber(value: any): value is number {
  return typeof value === 'number';
}

const Paths = {
  SEP: '.',
  isNumericKey(key: string) {
    return IS_NUMERIC_KEY.test(key);
  },
  setSep(sep: string) {
    this.SEP = sep;
  },
  transformPath(pathA: PathString, pathB: PathString, direction: 1 | -1 = 1) {
    const aParts = Paths.toParts(pathA);
    const bParts = Paths.toParts(pathB);

    let result: PathPart[] = aParts;

    /* 
    As soon as a modification is made we can exit because it means they 
    are no longer on identical paths
     */
    for (const key in aParts) {
      const aPart = aParts[key];
      const bPart = bParts[key];

      /* 
      If this part of the path is number indexed
      */
      if (isNumber(aPart) && isNumber(bPart)) {
        const aIndex = Number(aPart);
        const bIndex = Number(bPart);

        if (aIndex >= bIndex) {
          result[key] = `${aIndex + direction}`;
          return Paths.fromParts(result);
        }
        continue;
      }

      /* 
      Otherwise we are dealing with named parts that arent moved 
      when another element is added
      */
      if (aPart === bPart) {
        /* 
        These parts are the same. 
        No need to change them but we do need to check for nested indicies
        */
        continue;
      } else {
        return pathA;
      }
    }

    /* 
    No change was made 
    */
    return pathA;
  },
  isDescendant(path: PathString, ancestor: PathString) {
    if (Paths.areEqual(path, ancestor)) return false;
    if (path.includes(ancestor)) return true;
    return false;
  },
  areEqual(pathA: PathString, pathB: PathString) {
    return pathA === pathB;
  },
  fromParts(parts: PathPart[], sep = this.SEP) {
    return parts.join(sep);
  },
  toParts(path: PathString, sep = this.SEP) {
    return path.split(sep).map(part => {
      if (Paths.isNumericKey(part)) {
        return Number(part);
      }
      return part;
    });
  },
  parent(path: PathString, level = 1) {
    if (!level) return path;
    const parts = Paths.toParts(path);
    const newParts = parts.slice(0, parts.length - level);
    return Paths.fromParts(newParts);
  },
};

export default Paths;
