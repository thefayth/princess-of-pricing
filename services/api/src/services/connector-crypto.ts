import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

type EncryptedValue = { iv: string; tag: string; ciphertext: string };

function key() {
  if (!env.CONNECTOR_ENCRYPTION_KEY) throw new AppError(503, "Encrypted connectors are not configured");
  const value = Buffer.from(env.CONNECTOR_ENCRYPTION_KEY, "base64");
  if (value.length !== 32) throw new AppError(503, "Connector encryption key is invalid");
  return value;
}

export function encryptConnectorValue(value: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

export function decryptConnectorValue(value: EncryptedValue) {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
