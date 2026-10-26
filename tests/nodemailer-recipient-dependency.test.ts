import { describe, expect, it } from "vitest";
import nodemailer from "nodemailer";

// Characterize the dependency at the generated SMTP envelope boundary.
// streamTransport never connects to SMTP or sends an external message.
describe("Nodemailer keeps quoted/comment text out of recipient routing", () => {
  it.each([
    {
      name: "nested comment",
      to: "Member (outer(inner) <other@outside.test>) <member@inside.test>",
    },
    {
      name: "semicolon in a group comment",
      to: "Team: (note; <other@outside.test>) <member@inside.test>;",
    },
    {
      name: "angle bracket in a quoted local part",
      to: '<"mail@outside.test>"@inside.test>',
    },
  ])("routes $name only to its actual mailbox domain", async ({ to }) => {
    const transport = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
    });
    try {
      const result = await transport.sendMail({
        from: "sender@inside.test",
        to,
        subject: "Local envelope fixture",
        text: "Synthetic content, never sent.",
      });
      expect(result.envelope.to).toHaveLength(1);
      expect(result.envelope.to[0].split("@").at(-1)).toBe("inside.test");
    } finally {
      transport.close();
    }
  });
});
