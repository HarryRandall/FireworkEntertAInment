/** Relative inspector bounds use the reference editor controls; stored fields retain renderer units. */
/** One bounded scalar with word labels at either end and an authored-unit step. */
export interface RelativeControl<K extends string = string> {
  key: K;
  label: string;
  low: string;
  high: string;
  min: number;
  max: number;
  step: number;
}
