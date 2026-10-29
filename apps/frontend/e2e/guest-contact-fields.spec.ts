import { expect, test } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test("club phone masks digits, accepts Russian pastes and supports editing", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/club");
  const phones = page.getByRole("textbox", {
    name: "Номер телефона",
    exact: true,
  });
  const phone = phones.first();
  await expect(phones).toHaveCount(2);
  await expect(phone).toHaveAttribute("inputmode", "numeric");
  await phone.pressSequentially("abc9991234567!");
  await expect(phone).toHaveValue("+7 (999) 123-45-67");
  await expect(phones.last()).toHaveValue("+7 (999) 123-45-67");
  expect(
    await phone.evaluate((input: HTMLInputElement) => input.validity.valid),
  ).toBe(true);
  for (const value of [
    "89991234567",
    "9991234567",
    "+7 (999) 123-45-67",
    "abc89991234567xyz",
  ]) {
    await phone.fill(value);
    await expect(phone).toHaveValue("+7 (999) 123-45-67");
  }
  await phone.fill("+7999");
  await expect(phone).toHaveValue("+7 (999)");
  await phone.press("End");
  await phone.press("Backspace");
  await expect(phone).toHaveValue("+7 (99");
  expect(
    await phone.evaluate((input: HTMLInputElement) => input.validity.valid),
  ).toBe(false);
  await phone.fill("+79991234567");
  await phone.evaluate((input: HTMLInputElement) =>
    input.setSelectionRange(4, 5),
  );
  await phone.press("8");
  await expect(phone).toHaveValue("+7 (899) 123-45-67");
  await phone.press("ControlOrMeta+a");
  await phone.press("Backspace");
  await expect(phone).toHaveValue("");
  await expect(phones.last()).toHaveValue("");
});
