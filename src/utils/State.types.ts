import { JSX } from "hono/jsx";

export type BuiltInCondition = "valid" | "invalid" | "checked" | "unchecked" | "focused";
export type AnimationPresetName = "fade" | "fade-in" | "slide-up" | "slide-down" | "scale" | "slide-left" | "slide-right";

export type StateCondition<V extends string> = BuiltInCondition | V;

export type WrapperProps = {
  tag?: string;
  children?: any;
} & Record<string, any>;

export type TriggerProps = {
  value: string;
  children?: any;
};

export type EffectProps<V extends string> = {
  when: StateCondition<V>;
  tag?: string;
  animate?: AnimationPresetName;
  transition?: string;
  children?: any;
} & Record<string, any>;

export interface AnimationPreset {
  hidden: Record<string, string>;
  transition: string;
}
