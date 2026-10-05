// Built locally with Python's in-memory ZIP writer: content types, root relationship
// and a minimal Word document. No user's documents or remote fixtures are used.
export const docxMime =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const docxFixture = Buffer.from(
  "UEsDBBQAAAAIAJGURV3mdcR+0gAAAIsBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QvVLDMAzHX8XnlasVGBh6SToAKzD0BXSOkvjw11luad++Sls6cIVR+n/8ZLebQ/BqT4Vdip1+NI3e9O32mImVKJE7Pdea1wBsZwrIJmWKooypBKwylgky2i+cCJ6a5hlsipViXdWlQ/ftK42481W9HWR9oRTyrNXLxbiwOo05e2exig77OPyirK4EI8mzh2eX+UEMGu4SFuVvwDX3Ic8ubiD1iaW+YxAXfKcywJDsLkjS/F9z5840js7SLb+05ZIsMbs4BW9uSkAXf+6H83f3J1BLAwQUAAAACACRlEVdXzOVUpUAAAAHAQAACwAAAF9yZWxzLy5yZWxzjc87DsIwDAbgq0Q+QJ0yMKCmXVi6Ii4QJW5T0TzkhNftycBAEQOjf//6LHfDw6/iRpyXGBS0jYSh70606lKD7JaURW2ErMCVkg6I2TjyOjcxUaibKbLXpY48Y9LmomfCnZR75E8DtqYYrQIebQvi/Ez0jx2naTF0jObqKZQfJ74aVdY8U1Fwj2zRvuOmsoB9h5sX+xdQSwMEFAAAAAgAkZRFXRGUybSJAAAAuQAAABEAAAB3b3JkL2RvY3VtZW50LnhtbEWOMQ6DMAxFr4JyAEw7dEABts69Ag0uRCJxZJtCb1+SDl2e9f2/v2yHI6zVG1k8xc5c6sYMvd3bidwWMGp12lHavTOLamoBxC0YRqkpYTy9F3EY9ZQ8w048JSaHIj7OYYVr09wgjD6aXPmk6ZNnyuAM7e/+0I3RQhaZXFgigk4fDGXxu4X/X/0XUEsBAhQDFAAAAAgAkZRFXeZ1xH7SAAAAiwEAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAACACRlEVdXzOVUpUAAAAHAQAACwAAAAAAAAAAAAAAgAEDAQAAX3JlbHMvLnJlbHNQSwECFAMUAAAACACRlEVdEZTJtIkAAAC5AAAAEQAAAAAAAAAAAAAAgAHBAQAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAMAAwC5AAAAeQIAAAAA",
  "base64",
);
// Advertises the macro-enabled package type; there is no executable macro payload.
export const docmFixture = Buffer.from(
  "UEsDBBQAAAAIAJGURV0flX0NzwAAAHEBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2Qu1IDMQxFf8XjlllrSUHB7G4KSBso+AHhVbIe/BrLCeHvkZNAwQClfe/RkT2sT8GrIxV2KY761vR6PQ0vH5lYSRJ51Eut+R6A7UIB2aRMUZJdKgGrHMseMto33BOs+v4ObIqVYu1qm6Gn4ZF2ePBVbU5yfbEU8qzVw6XYXKPGnL2zWCWHY5x/WLqrwQh57vDiMt9IQcOvhpb8LbhyT/Ls4mZSz1jqFoO04D2VGeZkD0FI8/+YtmfgriHmGwloS9pEfPUkKbr4tSWcP3X6BFBLAwQUAAAACACRlEVdXzOVUpUAAAAHAQAACwAAAF9yZWxzLy5yZWxzjc87DsIwDAbgq0Q+QJ0yMKCmXVi6Ii4QJW5T0TzkhNftycBAEQOjf//6LHfDw6/iRpyXGBS0jYSh70606lKD7JaURW2ErMCVkg6I2TjyOjcxUaibKbLXpY48Y9LmomfCnZR75E8DtqYYrQIebQvi/Ez0jx2naTF0jObqKZQfJ74aVdY8U1Fwj2zRvuOmsoB9h5sX+xdQSwMEFAAAAAgAkZRFXRGUybSJAAAAuQAAABEAAAB3b3JkL2RvY3VtZW50LnhtbEWOMQ6DMAxFr4JyAEw7dEABts69Ag0uRCJxZJtCb1+SDl2e9f2/v2yHI6zVG1k8xc5c6sYMvd3bidwWMGp12lHavTOLamoBxC0YRqkpYTy9F3EY9ZQ8w048JSaHIj7OYYVr09wgjD6aXPmk6ZNnyuAM7e/+0I3RQhaZXFgigk4fDGXxu4X/X/0XUEsBAhQDFAAAAAgAkZRFXR+VfQ3PAAAAcQEAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAACACRlEVdXzOVUpUAAAAHAQAACwAAAAAAAAAAAAAAgAEAAQAAX3JlbHMvLnJlbHNQSwECFAMUAAAACACRlEVdEZTJtIkAAAC5AAAAEQAAAAAAAAAAAAAAgAG+AQAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAMAAwC5AAAAdgIAAAAA",
  "base64",
);
export const zipFixture = Buffer.from(
  "UEsDBBQAAAAIAJGURV3uQOUFCQAAAAcAAAAIAAAAbm90ZS50eHRLy6woKS1KBQBQSwECFAMUAAAACACRlEVd7kDlBQkAAAAHAAAACAAAAAAAAAAAAAAAgAEAAAAAbm90ZS50eHRQSwUGAAAAAAEAAQA2AAAALwAAAAAA",
  "base64",
);

// Minimal one-page PDF with independently constructed, byte-accurate xref offsets.
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, object] of [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>",
].entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += "xref\n0 4\n0000000000 65535 f \n";
pdf += offsets
  .slice(1)
  .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
  .join("");
pdf += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
export const pdfFixture = Buffer.from(pdf);
