"use strict";

/* eslint-disable no-unused-expressions, no-undef */

require("./setup");
const sinon = require("sinon");

const Credstash = require("../index");
const encryption = require("./utils/encryption");

const encrypter = require("../lib/encrypter");
const defaults = require("../lib/defaults");
const utils = require("../lib/utils");

describe("index", () => {
  const defCredstash = (options) =>
    new Credstash(Object.assign({ awsOpts: { region: "us-east-1" } }, options));

  describe("#constructor", () => {
    it("has methods to match credstash", () => {
      const credstash = defCredstash();
      credstash.paddedInt.should.exist;
      credstash.getHighestVersion.should.exist;
      credstash.listSecrets.should.exist;
      credstash.putSecret.should.exist;
      credstash.getAllSecrets.should.exist;
      credstash.getAllVersions.should.exist;
      credstash.getSecret.should.exist;
      credstash.deleteSecrets.should.exist;
      credstash.createDdbTable.should.exist;
    });

    it("should use a callback if provided", () => {
      const table = "TableNameNonDefault";
      const credstash = defCredstash(table);
      credstash.createDdbTable(() => {
        expect(err).to.not.exist;
      });
    });

    it("should use a callback for errors, and not throw an exception", () => {
      const table = "TableNameNonDefault";
      const credstash = defCredstash(table);
      credstash
        .createDdbTable((err) => {
          expect(err).to.exist;
          err.should.equal("Error");
        })
        .then()
        .catch((err) => err);
    });

    it("should return the configuration", () => {
      const region = "us-east-1";
      const credstash = defCredstash();
      const newConfig = credstash.getConfiguration();
      newConfig.should.eql({
        config: {
          awsOpts: {
            region,
          },
        },
        dynamoConfig: {
          table: defaults.DEFAULT_TABLE,
          opts: {
            region,
          },
        },
        kmsConfig: {
          kmsKey: defaults.DEFAULT_KMS_KEY,
          opts: {
            region,
          },
        },
      });
    });

    it("should allow separate options for KMS and DynamoDB", () => {
      const region = "us-east-1";

      const dynamoOpts = {
        region: "us-west-1",
        endpoint: "https://service1.region.amazonaws.com",
      };

      const kmsOpts = {
        region: "us-west-2",
        endpoint: "https://service2.region.amazonaws.com",
      };

      const credstash = defCredstash({
        dynamoOpts,
        kmsOpts,
      });
      const newConfig = credstash.getConfiguration();
      newConfig.should.eql({
        config: {
          dynamoOpts,
          kmsOpts,
          awsOpts: {
            region,
          },
        },
        dynamoConfig: {
          table: defaults.DEFAULT_TABLE,
          opts: dynamoOpts,
        },
        kmsConfig: {
          kmsKey: defaults.DEFAULT_KMS_KEY,
          opts: kmsOpts,
        },
      });
    });
  });

  describe("#getHighestVersion", () => {
    let asPromiseStub;

    beforeEach(() => {
      asPromiseStub = sinon.stub(utils, "asPromise");
    });

    afterEach(() => {
      asPromiseStub.restore();
    });
    it("should return the highest version", () => {
      const Items = [
        {
          name: "name1",
          version: "version1",
        },
        {
          name: "name1",
          version: "version2",
        },
      ];
      asPromiseStub.callsFake(() => {
        return Promise.resolve({ Items });
      });
      const credstash = defCredstash();
      credstash
        .getHighestVersion({ name: "name1" })
        .then((version) => version.should.equal(Items[0].version))
        .catch((err) => err);
    });

    it("should default to version 0", () => {
      asPromiseStub.callsFake(() => {
        return Promise.resolve({ Items: [] });
      });

      const credstash = defCredstash();
      return credstash
        .getHighestVersion({
          name: "name",
        })
        .then((version) => version.should.equal(0))
        .catch((err) => err);
    });

    it("should reject a missing name", () => {
      const credstash = defCredstash();
      return credstash
        .getHighestVersion()
        .then(() => {
          throw new Error("Error");
        })
        .catch((err) =>
          err.message.should.contain("name is a required parameter")
        );
    });
  });

  describe("#incrementVersion", () => {
    let asPromiseStub;

    beforeEach(() => {
      asPromiseStub = sinon.stub(utils, "asPromise");
    });

    afterEach(() => {
      asPromiseStub.restore();
    });
    it("should reject non integer versions", () => {
      asPromiseStub.callsFake(() => {
        return Promise.resolve({
          Items: {
            version: "hello world",
          },
        });
      });
      const credstash = defCredstash();
      return credstash
        .incrementVersion({ name: "name" })
        .then(() => "Should not get here")
        .catch((err) => {
          expect(err.message).to.exist;
          err.message.should.contain("is not an int");
        });
    });

    it("should return a padded version integer", () => {
      asPromiseStub.callsFake(() => {
        return Promise.resolve({ Items: [{ version: "1" }] });
      });
      const credstash = defCredstash();
      return credstash
        .incrementVersion({
          name: "name",
        })
        .then((version) => version.should.equal("0000000000000000002"))
        .catch((err) => err);
    });

    it("should accept name as a param", () => {
      const name = "name";
      asPromiseStub.callsFake(() => {
        return Promise.resolve({
          Items: [
            {
              version: "1",
            },
          ],
        });
      });
      const credstash = defCredstash();
      return credstash
        .incrementVersion({ name })
        .then((version) => version.should.equal("0000000000000000002"))
        .catch((err) => err);
    });
  });

  describe("#putSecret", () => {
    let realOne;
    let asPromiseStub;

    beforeEach(() => {
      realOne = Object.assign({}, encryption.credstashKey);
      asPromiseStub = sinon.stub(utils, "asPromise");
    });

    afterEach(() => {
      asPromiseStub.restore();
    });

    it("should create a new stash", () => {
      // kmsMock.on(GenerateDataKeyCommand).resolvesOnce(realOne.kms);

      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve(realOne.kms);
      });

      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve("Success");
      });
      const credstash = defCredstash();
      return credstash
        .putSecret({
          name: realOne.name,
          secret: realOne.plainText,
          version: realOne.version,
        })
        .then((res) => res.should.equal("Success"))
        .catch((err) => err);
    });

    it("should default the version to a zero padded 1", () => {
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve(realOne.kms);
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve("Success");
      });
      const credstash = defCredstash();
      return credstash
        .putSecret({
          name: realOne.name,
          secret: realOne.plainText,
        })
        .then((res) => res.should.equal("Success"))
        .catch((err) => err);
    });

    it("should convert numerical versions to padded strings", () => {
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve(realOne.kms);
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve("Success");
      });
      const credstash = defCredstash();
      return credstash
        .putSecret({
          name: realOne.name,
          secret: realOne.plainText,
          version: 42,
        })
        .then((res) => res.should.equal("Success"))
        .catch((err) => err);
    });

    it("should default the digest to SHA256", () => {
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve(realOne.kms);
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve("Success");
      });
      const credstash = defCredstash();
      return credstash
        .putSecret({
          name: realOne.name,
          secret: realOne.plainText,
        })
        .then((res) => res.should.equal("Success"))
        .catch((err) => err);
    });

    it("should use the correct context", () => {
      const context = { key: "value" };
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve(realOne.kms);
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve("Success");
      });
      const credstash = defCredstash();
      return credstash
        .putSecret({
          name: realOne.name,
          secret: realOne.plainText,
          version: realOne.version,
          context,
        })
        .then((res) => res.should.equal("Success"))
        .catch((err) => err);
    });

    it("should use the provided digest", () => {
      const digest = "MD5";
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve(realOne.kms);
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve("Success");
      });
      const credstash = defCredstash();
      return credstash
        .putSecret({
          name: realOne.name,
          secret: realOne.plainText,
          version: realOne.version,
          digest,
        })
        .then((res) => res.should.equal("Success"))
        .catch((err) => err);
    });

    it("should rethrow a NotFoundException from KMS", () => {
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.reject({
          code: "NotFoundException",
          message: "Success",
          random: 1234,
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve(new Error("Error"));
      });
      const credstash = defCredstash();
      return credstash
        .putSecret({
          name: realOne.name,
          secret: realOne.plainText,
        })
        .then((res) => expect(res).to.not.exist)
        .catch((err) => {
          err.message.should.equal("Success");
          err.code.should.equal("NotFoundException");
          err.random.should.equal(1234);
        });
    });

    it("should throw an error for a bad KMS key", () => {
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.reject({
          code: "Key Exception of some other sort",
          message: "Failure",
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve(new Error("Error"));
      });
      const credstash = defCredstash({
        kmsKey: "test",
      });
      return credstash
        .putSecret({
          name: realOne.name,
          secret: realOne.plainText,
        })
        .then((res) => expect(res).to.not.exist)
        .catch((err) =>
          err.message.should.contains(
            "Could not generate key using KMS key test"
          )
        );
    });

    it("should notify of duplicate name/version pairs", () => {
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve(realOne.kms);
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.reject({
          code: "ConditionalCheckFailedException",
        });
      });
      const credstash = defCredstash({
        kmsKey: "test",
      });
      return credstash
        .putSecret({
          name: realOne.name,
          secret: realOne.plainText,
        })
        .then((res) => expect(res).to.not.exist)
        .catch((err) =>
          err.message.should.contain("is already in the credential store.")
        );
    });

    it("should reject missing options", () => {
      const credstash = defCredstash();
      return credstash
        .putSecret()
        .catch((err) =>
          err.message.should.equal("name is a required parameter")
        );
    });

    it("should reject a missing name", () => {
      const credstash = defCredstash();
      return credstash
        .putSecret({
          secret: "secret",
        })
        .catch((err) =>
          err.message.should.equal("name is a required parameter")
        );
    });

    it("should reject a missing secret", () => {
      const credstash = defCredstash();
      return credstash
        .putSecret({
          name: "name",
        })
        .then(() => {
          throw new Error("Error");
        })
        .catch((err) =>
          err.message.should.equal("secret is a required parameter")
        );
    });
  });

  describe("#getAllVersions", () => {
    let asPromiseStub;

    beforeEach(() => {
      asPromiseStub = sinon.stub(utils, "asPromise");
    });

    afterEach(() => {
      asPromiseStub.restore();
    });

    it("should reject requests without a name", () => {
      const limit = 5;
      const credstash = defCredstash();
      return credstash
        .getAllVersions({
          limit,
        })
        .then(() => {
          throw new Error("Error");
        })
        .catch((err) =>
          err.message.should.equal("name is a required parameter")
        );
    });

    it("should fetch and decode the secrets", () => {
      const name = "name";
      const limit = 5;
      const rawItem = encryption.credstashKey;

      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({
          Items: [
            {
              version: "0000000000000000006",
              contents: rawItem.contents,
              key: rawItem.key,
              hmac: rawItem.hmac,
            },
          ],
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve(rawItem.kms);
      });

      const credentials = defCredstash();
      return credentials
        .getAllVersions({
          name,
          limit,
        })
        .then((allVersions) => {
          allVersions[0].version.should.equal("0000000000000000006");
          allVersions[0].secret.should.equal(rawItem.plainText);
        })
        .catch((err) => err);
    });

    it("should default to all versions", () => {
      const name = "name";
      const rawItem = encryption.credstashKey;

      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({
          Items: [
            {
              version: "0000000000000000006",
              contents: rawItem.contents,
              key: rawItem.key,
              hmac: rawItem.hmac,
            },
          ],
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve(rawItem.kms);
      });

      const credentials = defCredstash();
      return credentials
        .getAllVersions({
          name,
        })
        .then((allVersions) => {
          allVersions[0].version.should.equal("0000000000000000006");
          allVersions[0].secret.should.equal(rawItem.plainText);
        })
        .catch((err) => err);
    });
  });

  describe("#getSecret", () => {
    let asPromiseStub;

    beforeEach(() => {
      asPromiseStub = sinon.stub(utils, "asPromise");
    });

    afterEach(() => {
      asPromiseStub.restore();
    });

    it("should fetch and decode a secret", () => {
      const name = "name";
      const version = "version1";
      const rawItem = encryption.credstashKey;
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({
          Item: {
            contents: rawItem.contents,
            key: rawItem.key,
            hmac: rawItem.hmac,
          },
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve(rawItem.kms);
      });

      const credentials = defCredstash();
      return credentials
        .getSecret({
          name,
          version,
        })
        .then((secret) => secret.should.equal(rawItem.plainText))
        .catch((err) => err);
    });

    it("should reject a missing name", () => {
      const credentials = defCredstash();
      return credentials
        .getSecret({ version: "version" })
        .then(() => {
          throw new Error("Should not succeed");
        })
        .catch((err) =>
          err.message.should.contain("name is a required parameter")
        );
    });

    it("should reject a missing name with default options", () => {
      const credentials = defCredstash();
      return credentials
        .getSecret()
        .then(() => {
          throw new Error("Should not succeed");
        })
        .catch((err) =>
          err.message.should.contain("name is a required parameter")
        );
    });

    it("should not reject a missing version", () => {
      const version = "version1";
      const rawItem = encryption.credstashKey;
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({
          Items: [
            {
              contents: rawItem.contents,
              key: rawItem.key,
              hmac: rawItem.hmac,
              version,
            },
          ],
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve(rawItem.kms);
      });
      const credentials = defCredstash();
      return credentials
        .getSecret({ name: "name" })
        .then((secret) => secret.should.equal(rawItem.plainText))
        .catch((err) => expect(err).to.not.exist);
    });

    it("should default version to the latest", () => {
      const rawItem = encryption.credstashKey;
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve(new Error("Error"));
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve({
          Items: [
            {
              contents: rawItem.contents,
              key: rawItem.key,
              hmac: rawItem.hmac,
            },
          ],
        });
      });
      asPromiseStub.onCall(2).callsFake(() => {
        return Promise.resolve(rawItem.kms);
      });
      const credentials = defCredstash();
      return credentials
        .getSecret({
          name: "name",
        })
        .then((secret) => secret.should.exist)
        .catch((err) => err);
    });

    it("should throw an exception for a missing key", () => {
      const name = "name";
      const version = "version1";
      const rawItem = encryption.credstashKey;
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({
          Item: {
            contents: rawItem.contents,
            hmac: rawItem.hmac,
          },
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve(new Error("Error"));
      });

      const credentials = defCredstash();
      return credentials
        .getSecret({
          name,
          version,
        })
        .then(() => {
          throw new Error("Error");
        })
        .catch((err) => {
          expect(err.message).to.exist;
          err.message.should.contain("could not be found");
        });
    });

    it("should throw an exception for invalid cipherText, no context", () => {
      const name = "name";
      const version = "version1";
      const rawItem = encryption.credstashKey;

      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({
          Item: {
            contents: rawItem.contents,
            hmac: rawItem.hmac,
            key: rawItem.key,
          },
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve({ code: "InvalidCiphertextException" });
      });

      const credentials = defCredstash();
      return credentials
        .getSecret({
          name,
          version,
        })
        .then(() => {
          throw new Error("Error");
        })
        .catch((err) => {
          expect(err.message).to.exist;
        });
    });

    it("should throw an exception for invalid cipherText, with context", () => {
      const name = "name";
      const version = "version1";
      const rawItem = encryption.credstashKey;
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({
          Item: {
            contents: rawItem.contents,
            hmac: rawItem.hmac,
            key: rawItem.key,
          },
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve({ code: "InvalidCiphertextException" });
      });

      const credentials = defCredstash();
      return credentials
        .getSecret({
          name,
          version,
          context: {
            key: "value",
          },
        })
        .then(() => {
          throw new Error("Error");
        })
        .catch((err) => {
          expect(err.message).to.exist;
        });
    });

    it("should throw an exception for invalid cipherText, with context", () => {
      const name = "name";
      const version = "version1";
      const rawItem = encryption.credstashKey;
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({
          Item: {
            contents: rawItem.contents,
            hmac: rawItem.hmac,
            key: rawItem.key,
          },
        });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve(new Error("Correct Error"));
      });

      const credentials = defCredstash();
      return credentials
        .getSecret({
          name,
          version,
          context: {
            key: "value",
          },
        })
        .then(() => {
          throw new Error("Error");
        })
        .catch((err) => {
          expect(err.message).to.exist;
        });
    });
  });

  describe("#deleteSecrets", () => {
    let asPromiseStub;

    beforeEach(() => {
      asPromiseStub = sinon.stub(utils, "asPromise");
    });

    afterEach(() => {
      asPromiseStub.restore();
    });

    it("should reject empty options", () => {
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve(new Error("Error"));
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve(new Error("Error"));
      });
      const credstash = defCredstash();
      return credstash
        .deleteSecrets()
        .then((res) => expect(res).to.not.exist)
        .catch((err) =>
          err.message.should.equal("name is a required parameter")
        );
    });

    it("should reject missing name", () => {
      const credstash = defCredstash();
      return credstash
        .deleteSecrets({})
        .then((res) => expect(res).to.not.exist)
        .catch((err) =>
          err.message.should.equal("name is a required parameter")
        );
    });

    it("should delete all versions of a given name", () => {
      const name = "name";
      const Items = Array.from({ length: 10 }, (v, i) => ({
        name,
        version: `${i}`,
      }));

      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({ Items });
      });
      asPromiseStub.onCall(1).callsFake(() => {
        return Promise.resolve("Success");
      });

      const credstash = defCredstash();
      return credstash
        .deleteSecrets({
          name,
        })
        .then((res) => res.forEach((next) => next.should.equal("Success")))
        .catch((err) => err);
    });
  });

  describe("#deleteSecret", () => {
    const name = "name";
    const version = "version";
    const numVer = 42;

    let asPromiseStub;

    beforeEach(() => {
      asPromiseStub = sinon.stub(utils, "asPromise");
    });

    afterEach(() => {
      asPromiseStub.restore();
    });

    it("should reject empty options", () => {
      const credstash = defCredstash();
      return credstash
        .deleteSecret()
        .then((res) => expect(res).to.not.exist)
        .catch((err) =>
          err.message.should.equal("name is a required parameter")
        );
    });

    it("should reject a missing name", () => {
      const credstash = defCredstash();
      return credstash
        .deleteSecret({ version })
        .then((res) => expect(res).to.not.exist)
        .catch((err) =>
          err.message.should.equal("name is a required parameter")
        );
    });

    it("should reject missing version", () => {
      const credstash = defCredstash();
      return credstash
        .deleteSecret({ name })
        .then((res) => expect(res).to.not.exist)
        .catch((err) =>
          err.message.should.equal("version is a required parameter")
        );
    });

    it("should delete the correct item", () => {
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve("Success");
      });

      const credstash = defCredstash();
      return credstash
        .deleteSecret({ name, version })
        .then((res) => res.should.equal("Success"))
        .catch((err) => err);
    });

    it("should convert numerical versions into strings", () => {
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve("Success");
      });

      const credstash = defCredstash();
      return credstash
        .deleteSecret({ name, version: numVer })
        .then((res) => res.should.equal("Success"))
        .catch((err) => err);
    });
  });

  describe("#listSecrets", () => {
    let asPromiseStub;

    beforeEach(() => {
      asPromiseStub = sinon.stub(utils, "asPromise");
    });

    afterEach(() => {
      asPromiseStub.restore();
    });

    it("should return all secret names and versions", () => {
      const items = [
        { name: "name", version: "version1" },
        { name: "name", version: "version2" },
      ];
      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve({ Items: items });
      });
      const credstash = defCredstash();
      return credstash
        .listSecrets()
        .then((results) => {
          results.length.should.equal(2);
          results[0].name.should.equal("name");
          results[0].version.should.equal("version2");
          results[1].name.should.equal("name");
          results[1].version.should.equal("version1");
        })
        .catch((err) => err);
    });
  });

  describe("#getAllSecrets", () => {
    let items;
    let kms;
    let asPromiseStub;

    const item1 = encryption.item;
    const item2 = encryption.credstashKey;

    function addItem(item) {
      items[item.name] = items[item.name] || {};
      items[item.name][item.version] = {
        contents: item.contents,
        key: item.key,
        hmac: item.hmac || item.hmacSha256,
        name: item.name,
        version: item.version,
      };
      kms[item.key] = item.kms;
    }

    afterEach(() => {
      asPromiseStub.restore();
    });

    beforeEach(() => {
      asPromiseStub = sinon.stub(utils, "asPromise");
      items = {};
      kms = {};

      addItem(item1);
      addItem(item2);
    });

    it("should return all secrets", () => {
      asPromiseStub.callsFake(() => {
        return Promise.resolve({ items });
      });
      const credstash = defCredstash();
      return credstash
        .getAllSecrets()
        .then((res) => {
          Object.keys(res).length.should.equal(2);
        })
        .catch((err) => err);
    });

    it('should return all secrets starts with "some.secret"', () => {
      asPromiseStub.callsFake(() => {
        return Promise.resolve({ items });
      });
      const credstash = defCredstash();
      return credstash
        .getAllSecrets({ startsWith: "some.secret" })
        .then((res) => {
          Object.keys(res).length.should.equal(1);
        })
        .catch((err) => err);
    });

    it("should ignore bad secrets", () => {
      const item3 = Object.assign({}, item1);
      item3.contents += "hello broken";
      item3.name = "differentName";
      addItem(item3);
      asPromiseStub.callsFake(() => {
        return Promise.resolve({ items });
      });
      const credstash = defCredstash();
      return credstash
        .getAllSecrets()
        .then((res) => {
          Object.keys(res).length.should.equal(2);
          const unsorted = Object.keys(res);
          const sorted = Object.keys(res).sort();
          unsorted.should.deep.equal(sorted);
        })
        .catch((err) => err);
    });

    it("should return all secrets, but only latest version", () => {
      const item3 = Object.assign({}, item1);
      item3.version = item3.version.replace("1", "2");
      item3.plainText = "This is a new plaintext";
      const encrypted = encrypter.encrypt(
        undefined,
        item3.plainText,
        item3.kms
      );
      item3.contents = encrypted.contents;
      item3.hmac = encrypted.hmac;

      addItem(item3);

      asPromiseStub.callsFake(() => {
        return Promise.resolve({ items });
      });

      const credstash = defCredstash();
      return credstash
        .getAllSecrets()
        .then((res) => {
          Object.keys(res).length.should.equal(2);
          res[item3.name].should.equal(item3.plainText);
        })
        .catch((err) => err);
    });
  });

  describe("#createDdbTable", () => {
    let asPromiseStub;

    beforeEach(() => {
      asPromiseStub = sinon.stub(utils, "asPromise");
    });

    afterEach(() => {
      asPromiseStub.restore();
    });
    it("should call createTable with the table name provided", () => {
      const table = "TableNameNonDefault";

      asPromiseStub.onCall(0).callsFake(() => {
        return Promise.resolve();
      });
      const credstash = defCredstash({ table });
      return credstash
        .createDdbTable()
        .catch((err) => expect(err).to.not.exist);
    });
  });
});
