export type StoredObjectMetadata = {
  contentLength: number;
  contentType: string | null;
  etag: string | null;
};

export interface ObjectStorage {
  createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<string>;
  createDownloadUrl(input: {
    key: string;
    fileName: string;
    expiresInSeconds: number;
  }): Promise<string>;
  headObject(key: string): Promise<StoredObjectMetadata | null>;
  readObjectPrefix(key: string, byteCount: number): Promise<Uint8Array>;
  deleteObject(key: string): Promise<void>;
}
