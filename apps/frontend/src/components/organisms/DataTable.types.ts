import type { ReactNode } from "react";

type DataTableColumnForKey<
  T,
  K extends keyof T,
> = {
  key: K;
  label: string;
  render?: (value: T[K], row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export type DataTableColumn<T> = {
  [K in keyof T]: DataTableColumnForKey<T, K>;
}[keyof T];

export const createDataTableColumn =
  <T>() =>
    <K extends keyof T>(
      column: DataTableColumnForKey<T, K>,
    ): DataTableColumnForKey<T, K> =>
      column;