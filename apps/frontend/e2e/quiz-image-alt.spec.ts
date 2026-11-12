import { expect, test } from "@playwright/test";
import { QUESTIONS } from "../src/domain/quiz/quiz-data";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test("all 42 visual answers have real image alternatives and accessible descriptions", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/quiz");
  await page
    .getByRole("button", { name: "Начать путешествие", exact: true })
    .click();
  let checked = 0;
  for (const [questionIndex, question] of QUESTIONS.entries()) {
    if (question.headerImage) {
      await expect(
        page.getByRole("img", { name: question.headerImage.alt, exact: true }),
      ).toHaveAttribute("alt", question.headerImage.alt);
    }
    if (question.type === "visual") {
      for (const [index, answer] of question.answers.entries()) {
        const button = page.getByRole("button", {
          name: `Выбрать изображение ${index + 1}`,
          exact: true,
        });
        await expect(button).toHaveAccessibleDescription(answer.image!.alt);
        await expect(button.locator("img")).toHaveAttribute(
          "alt",
          answer.image!.alt,
        );
        checked++;
      }
      await page
        .getByRole("button", { name: "Выбрать изображение 1", exact: true })
        .click();
    } else {
      await page.locator('[class*="textAnswers"] button').first().click();
    }
    if (questionIndex < QUESTIONS.length - 1) {
      await page.getByRole("button", { name: "Далее →", exact: true }).click();
    }
  }
  expect(checked).toBe(42);
});
