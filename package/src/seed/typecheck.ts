/**
 * Compile-time regression guard for the seed DSL (no runtime tests).
 *
 * tsc (`npm run check:type`) covers this file; vitest ignores it. The
 * `@ts-expect-error` lines fail the build if the checks stop firing — e.g. a
 * widening regression on FakerProvider would let invalid faker paths through.
 */

import { fake } from "js-mvc/seed";

// Positive cases must compile.
const valid = [
  fake("internet.username"),
  fake("internet.email"),
  fake("person.fullName"),
  fake("image.avatar"),
  fake("lorem.sentence"),
  fake("helpers.slugify"),
];
void valid;

// Negative cases must keep erroring.

// @ts-expect-error wrong member for that namespace
fake("internet.fullName");

// @ts-expect-error wrong member for that namespace
fake("person.username");

// @ts-expect-error unknown namespace
fake("nope.username");
