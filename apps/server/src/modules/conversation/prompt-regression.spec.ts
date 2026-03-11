import { evaluatePromptRegressionCase } from "./prompt-regression.evaluator";
import { PROMPT_REGRESSION_CASES } from "./prompt-regression.dataset";

describe("prompt regression suite", () => {
  it("keeps core teaching quality contracts stable", () => {
    const results = PROMPT_REGRESSION_CASES.map((testCase) => ({
      testCase,
      result: evaluatePromptRegressionCase(testCase),
    }));

    const hardFailures = results.filter(({ testCase, result }) => {
      if (testCase.requiredFailures?.length) {
        return testCase.requiredFailures.some(
          (failureCode) => !result.failures.includes(failureCode),
        );
      }
      return result.score < testCase.expectedMinScore;
    });

    if (hardFailures.length > 0) {
      const report = hardFailures
        .map(
          ({ testCase, result }) =>
            `${testCase.id}: score=${result.score}, expected>=${testCase.expectedMinScore}, failures=${result.failures.join(",")}`,
        )
        .join("\n");
      throw new Error(`Prompt regression failed:\n${report}`);
    }
  });
});

