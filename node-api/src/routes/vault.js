const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const authMiddleware = require("../middleware/auth");
const { runCommand } = require("../keeper");

const router = express.Router();
const UPLOAD_TIMEOUT_MS = 60000;
const BUILT_IN_RECORD_TYPES = new Set([
  "address",
  "bankAccount",
  "bankCard",
  "birthCertificate",
  "contact",
  "databaseCredentials",
  "driverLicense",
  "encryptedNotes",
  "file",
  "general",
  "healthInsurance",
  "host",
  "identityCard",
  "login",
  "membership",
  "pamAws",
  "pamAzure",
  "pamDirectory",
  "pamMachine",
  "pamUser",
  "passport",
  "paymentCard",
  "photo",
  "serverCredentials",
  "socialSecurity",
  "softwareLicense",
  "sshKeys"
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "/tmp");
    },
    filename: (req, file, cb) => {
      const sanitizedName = (file.originalname || "upload.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${uuidv4()}-${sanitizedName}`);
    }
  })
});

router.use(authMiddleware);

function shellEscape(value) {
  if (value === undefined || value === null) {
    return '""';
  }

  return `"${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
}

function extractCommandData(result) {
  if (result && Object.prototype.hasOwnProperty.call(result, "result")) {
    return result.result;
  }

  if (result && Object.prototype.hasOwnProperty.call(result, "data")) {
    return result.data;
  }

  return result;
}

function normalizeListData(result) {
  const data = extractCommandData(result);

  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.records)) {
    return data.records;
  }

  return [];
}

function parseDetails(details) {
  const rawDetails = String(details || "");
  const typeMatch = rawDetails.match(/Type:\s*([^,]+)/i);
  const descriptionMatch = rawDetails.match(/Description:\s*(.*)$/i);

  return {
    category: typeMatch ? typeMatch[1].trim() : "",
    description: descriptionMatch ? descriptionMatch[1].trim() : ""
  };
}

function normalizeListRecord(record) {
  const parsed = parseDetails(record && record.details);

  return {
    uid: record && record.uid ? record.uid : null,
    title: record && record.name ? record.name : "",
    category: parsed.category,
    description: parsed.description
  };
}

function isCustomRecordType(type) {
  if (!type) {
    return false;
  }

  return !BUILT_IN_RECORD_TYPES.has(type);
}

async function listDetailedRecords() {
  const result = await runCommand("ls -l --format json");
  return normalizeListData(result).map(normalizeListRecord).filter((record) => record.uid);
}

function buildCategoryResponse(records, category) {
  return {
    category,
    count: records.length,
    records
  };
}

function getMimeType(fileName) {
  const extension = path.extname(fileName || "").toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

async function resolveRecordUid({ recordUid, recordTitle }) {
  if (recordUid) {
    return recordUid;
  }

  if (!recordTitle) {
    return null;
  }

  const records = await listDetailedRecords();
  const matches = records.filter((record) => record.title === recordTitle);

  if (matches.length === 1) {
    return matches[0].uid;
  }

  if (matches.length > 1) {
    throw new Error(`Multiple Keeper records matched title "${recordTitle}". Use recordUid instead.`);
  }

  throw new Error(`No Keeper record matched title "${recordTitle}".`);
}

router.get("/whoami", async (req, res) => {
  try {
    const result = await runCommand("whoami");
    return res.json({
      success: true,
      data: extractCommandData(result)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to execute whoami"
    });
  }
});

router.get("/list", async (req, res) => {
  try {
    const records = await listDetailedRecords();

    return res.json({
      success: true,
      data: {
        count: records.length,
        records
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to list vault records"
    });
  }
});

router.get("/images", async (req, res) => {
  try {
    const records = (await listDetailedRecords()).filter((record) => record.category === "photo");

    return res.json({
      success: true,
      data: buildCategoryResponse(records, "images")
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch image records"
    });
  }
});

router.get("/images/:recordUid/preview", async (req, res) => {
  let tempDir = null;

  try {
    const { recordUid } = req.params;

    if (!recordUid) {
      return res.status(400).json({
        success: false,
        error: "recordUid is required"
      });
    }

    const recordResult = await runCommand(`get --format json ${shellEscape(recordUid)}`);
    const record = extractCommandData(recordResult);

    if (!record || !record.record_uid) {
      return res.status(404).json({
        success: false,
        error: "Keeper record not found"
      });
    }

    if (String(record.type || "").toLowerCase() !== "photo") {
      return res.status(400).json({
        success: false,
        error: "Preview is only supported for Keeper image records"
      });
    }

    tempDir = path.join("/tmp", `keeper-preview-${uuidv4()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    await runCommand(
      `download-attachment --out-dir ${shellEscape(tempDir)} ${shellEscape(recordUid)}`,
      { timeoutMs: UPLOAD_TIMEOUT_MS }
    );

    const downloadedFiles = await fs.promises.readdir(tempDir);

    if (!downloadedFiles.length) {
      throw new Error("Keeper did not download any previewable image file");
    }

    const imageFileName = downloadedFiles.find((fileName) => getMimeType(fileName).startsWith("image/")) || downloadedFiles[0];
    const imageFilePath = path.join(tempDir, imageFileName);
    const mimeType = getMimeType(imageFileName);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(imageFileName).replace(/"/g, "")}"`);

    const stream = fs.createReadStream(imageFilePath);

    stream.on("error", async () => {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: "Failed to read preview image"
        });
      } else {
        res.destroy();
      }
    });

    res.on("finish", async () => {
      if (tempDir) {
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    res.on("close", async () => {
      if (tempDir) {
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    return stream.pipe(res);
  } catch (error) {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate image preview"
    });
  }
});

router.get("/attachment", async (req, res) => {
  try {
    const records = (await listDetailedRecords()).filter((record) => record.category === "file");

    return res.json({
      success: true,
      data: buildCategoryResponse(records, "attachments")
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch attachment records"
    });
  }
});

router.get("/form", async (req, res) => {
  try {
    const records = (await listDetailedRecords()).filter((record) => isCustomRecordType(record.category));

    return res.json({
      success: true,
      data: buildCategoryResponse(records, "forms")
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch form records"
    });
  }
});

router.post("/upload", upload.single("file"), async (req, res) => {
  let uploadedFilePath = null;

  try {
    const recordTitle = req.body ? req.body.recordTitle : null;
    const recordUid = req.body ? req.body.recordUid : null;
    const uploadedFile = req.file;

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: "file is required"
      });
    }

    if (!recordTitle && !recordUid) {
      await fs.promises.unlink(uploadedFile.path).catch(() => {});
      return res.status(400).json({
        success: false,
        error: "recordUid or recordTitle is required"
      });
    }

    uploadedFilePath = uploadedFile.path;
    const targetRecordUid = await resolveRecordUid({ recordUid, recordTitle });
    const command = `upload-attachment --file ${shellEscape(uploadedFilePath)} ${shellEscape(targetRecordUid)}`;
    const result = await runCommand(command, { timeoutMs: UPLOAD_TIMEOUT_MS });

    await fs.promises.unlink(uploadedFilePath).catch(() => {});

    return res.json({
      success: true,
      data: {
        filename: path.basename(uploadedFile.originalname),
        recordTitle,
        recordUid: targetRecordUid,
        result: extractCommandData(result)
      }
    });
  } catch (error) {
    if (uploadedFilePath) {
      await fs.promises.unlink(uploadedFilePath).catch(() => {});
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to upload attachment"
    });
  }
});

router.get("/download/:recordId", async (req, res) => {
  try {
    const { recordId } = req.params;

    if (!recordId) {
      return res.status(400).json({
        success: false,
        error: "recordId is required"
      });
    }

    // Direct binary attachment streaming is limited through Commander REST execution results.
    // See Keeper Commander docs: https://docs.keeper.io/en/secrets-manager/commander-cli/command-reference
    const result = await runCommand(`get --format json ${shellEscape(recordId)}`);

    return res.json({
      success: true,
      data: extractCommandData(result)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch record details"
    });
  }
});

module.exports = router;
