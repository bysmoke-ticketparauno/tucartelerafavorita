const SPREADSHEET_ID = "1M4a7OYFmbiRvAqS4Sw1bMV_fh6VSPWOWXCrOd7Jc9xk";
const FIRST_DATA_ROW = 2;
const DATA_COLUMN_COUNT = 4;
const SHEET_NAME = "Hoja 1";

function doPost(event) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const params = event && event.parameter ? event.parameter : {};
    const recommendation = [
      cleanValue(params.title || params.nombre),
      cleanValue(params.genre || params.categoria),
      cleanValue(params.review || params.mensaje),
      cleanValue(params.contact || params.email)
    ];

    if (recommendation.some((value) => value === "")) {
      return jsonResponse({ success: false, message: "Completa los cuatro campos." });
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];
    const lastRow = sheet.getLastRow();
    let existingRows = [];

    if (lastRow >= FIRST_DATA_ROW) {
      existingRows = sheet
        .getRange(FIRST_DATA_ROW, 1, lastRow - FIRST_DATA_ROW + 1, DATA_COLUMN_COUNT)
        .getValues()
        .filter((row) => row.some((value) => String(value).trim() !== ""));

      sheet
        .getRange(FIRST_DATA_ROW, 1, lastRow - FIRST_DATA_ROW + 1, DATA_COLUMN_COUNT)
        .clearContent();
    }

    if (existingRows.length > 0) {
      sheet.getRange(FIRST_DATA_ROW, 1, existingRows.length, DATA_COLUMN_COUNT).setValues(existingRows);
    }

    const nextRow = FIRST_DATA_ROW + existingRows.length;
    sheet.getRange(nextRow, 1, 1, DATA_COLUMN_COUNT).setValues([recommendation]);

    return jsonResponse({ success: true, row: nextRow, columns: "A:D" });
  } catch (error) {
    return jsonResponse({ success: false, message: String(error.message || error) });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function cleanValue(value) {
  const cleanedValue = String(value || "").trim();
  return /^[=+@]/.test(cleanedValue) ? `'${cleanedValue}` : cleanedValue;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
