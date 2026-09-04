export type MutableNumber = {
  read: () => number;
  write: (nextValue: number) => void;
};

/** Stores an imperative numeric value without tying it to React's render cycle. */
export function createMutableNumber(initialValue = 0): MutableNumber {
  let value = initialValue;

  return {
    read: () => value,
    write: (nextValue) => {
      value = nextValue;
    },
  };
}
