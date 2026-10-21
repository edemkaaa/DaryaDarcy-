import { z } from "zod";

// Match the existing signed INT columns; negative priorities remain supported.
export const contentSortOrderInput = z
  .number()
  .int()
  .min(-2_147_483_648)
  .max(2_147_483_647);

const calendarDate = z.iso.date();
const dateTime = z.iso.datetime({ offset: true, local: true });
const firstTimestamp = Date.parse("1970-01-01T00:00:01Z");
const lastTimestamp = Date.parse("2038-01-19T03:14:07Z");

export const postTimestampInput = z
  .string()
  .refine((value) => {
    // Empty string and null both cleared the optional date before validation.
    if (value === "") return true;
    // Preserve legacy local SQL datetime strings as well as ISO/offset inputs.
    if (
      !calendarDate.safeParse(value).success &&
      !dateTime.safeParse(value.replace(" ", "T")).success
    )
      return false;
    const time = Date.parse(value);
    return (
      Number.isFinite(time) && time >= firstTimestamp && time <= lastTimestamp
    );
  }, "Некорректная дата или дата вне диапазона хранения")
  .nullable()
  .optional();
