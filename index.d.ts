// Type definitions for aws-credstash
//
// Forked from node-credtash v2.0.0 types:
// Project: https://github.com/DavidTanner/nodecredstash
// Definitions by: Mike Cook <https://github.com/migstopheles>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="node"/>


import * as AWS_DynamoDBDocumentClient from "@aws-sdk/lib-dynamodb";
import * as AWS_DynamoDB from "@aws-sdk/client-dynamodb";
import * as AWS_KMS from "@aws-sdk/client-kms";

interface CredstashConfig {
  table?: string;
  awsOpts?: AWS_KMS.ClientConfiguration;
  dynamoOpts?: AWS_DynamoDB.ClientConfiguration;
  kmsKey?: string;
  kmsOpts?: AWS_KMS.ClientConfiguration;
}

interface CredstashContext {
  [key: string]: string;
}

interface PutSecretOptions {
  name: string;
  secret: string;
  context?: CredstashContext;
  digest?: string;
  version?: number;
}

interface Credstash {
  getHighestVersion: (options: {
    name: string;
  }) => Promise<Record<string, AWS_DynamoDB.AttributeValue>>;
  incrementVersion: (options: { name: string }) => Promise<string>;
  putSecret: (
    options: PutSecretOptions
  ) => Promise<AWS_DynamoDBDocumentClient.PutCommandOutput>;
  decryptStash: (
    stash: { key: string },
    context?: CredstashContext
  ) => Promise<AWS_KMS.DecryptCommandOutput>;
  getAllVersions: (options: {
    name: string;
    context?: CredstashContext;
    limit?: number;
  }) => Promise<Array<{ version: string; secret: string }>>;
  getSecret: (options: {
    name: string;
    context?: CredstashContext;
    version?: number;
  }) => Promise<string>;
  deleteSecrets: (options: {
    name: string;
  }) => Promise<AWS_DynamoDBDocumentClient.DeleteCommandOutput[]>;
  deleteSecret: (options: {
    name: string;
    version: number;
  }) => Promise<AWS_DynamoDBDocumentClient.DeleteCommandOutput>;
  listSecrets: () => Promise<string[]>;
  getAllSecrets: (options: {
    version?: number;
    context?: CredstashContext;
    startsWith?: string;
  }) => Promise<{ [key: string]: string }>;
  createDdbTable: () => Promise<void>;
}

declare function Credstash(config: CredstashConfig): Credstash;

export = Credstash;
