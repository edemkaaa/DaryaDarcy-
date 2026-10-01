import { describe, it, expect } from "vitest";

describe("Timeweb S3 Connection", () => {
  it("should have S3 environment variables configured", () => {
    // These are set via webdev_request_secrets
    expect(process.env.S3_ENDPOINT).toBeDefined();
    expect(process.env.S3_ENDPOINT).toBe("https://s3.twcstorage.ru");
    expect(process.env.S3_ACCESS_KEY).toBeDefined();
    expect(process.env.S3_ACCESS_KEY!.length).toBeGreaterThan(5);
    expect(process.env.S3_SECRET_KEY).toBeDefined();
    expect(process.env.S3_SECRET_KEY!.length).toBeGreaterThan(5);
    expect(process.env.S3_BUCKET).toBe("daryadarcy-s3");
  });

  it("should successfully upload a test file to S3", async () => {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT!,
      region: "ru-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: true,
    });

    const testKey = `_test/vitest-${Date.now()}.txt`;
    const testData = `Vitest connection test at ${new Date().toISOString()}`;

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: testKey,
        Body: Buffer.from(testData),
        ContentType: "text/plain",
        ACL: "public-read",
      }),
    );

    // If we get here without throwing, the upload succeeded
    const expectedUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${testKey}`;
    expect(expectedUrl).toContain("s3.twcstorage.ru");
    expect(expectedUrl).toContain("daryadarcy-s3");
  });
});
