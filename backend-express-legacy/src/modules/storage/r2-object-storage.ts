import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { ObjectStorage } from "./object-storage.js";

export type R2ObjectStorageConfiguration = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function safeDownloadName(fileName: string) {
  return fileName.replace(/[\r\n"\\]/g, "_").slice(0, 180);
}

export class R2ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly configuration: R2ObjectStorageConfiguration) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey,
      },
    });
  }

  createUploadUrl(input: { key: string; contentType: string; expiresInSeconds: number }) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.configuration.bucket,
        Key: input.key,
        ContentType: input.contentType,
      }),
      { expiresIn: input.expiresInSeconds },
    );
  }

  createDownloadUrl(input: { key: string; fileName: string; expiresInSeconds: number }) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.configuration.bucket,
        Key: input.key,
        ResponseContentDisposition: `attachment; filename="${safeDownloadName(input.fileName)}"`,
      }),
      { expiresIn: input.expiresInSeconds },
    );
  }

  async headObject(key: string) {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.configuration.bucket, Key: key }),
      );
      return {
        contentLength: response.ContentLength ?? 0,
        contentType: response.ContentType ?? null,
        etag: response.ETag?.replace(/^"|"$/g, "") ?? null,
      };
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (statusCode === 404 || (error as { name?: string }).name === "NotFound") return null;
      throw error;
    }
  }

  async readObjectPrefix(key: string, byteCount: number) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.configuration.bucket,
        Key: key,
        Range: `bytes=0-${Math.max(0, byteCount - 1)}`,
      }),
    );
    return response.Body ? response.Body.transformToByteArray() : new Uint8Array();
  }

  async deleteObject(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.configuration.bucket, Key: key }));
  }
}
