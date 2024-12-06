package org.enso.table.excel.xssfreader;

import java.time.LocalDateTime;
import java.util.SortedMap;
import org.apache.poi.ss.usermodel.Cell;
import org.enso.table.excel.ExcelRow;

public class XSSFReaderRow implements ExcelRow {
  private final SortedMap<Short, XSSFReaderSheetXMLHandler.CellValue> data;

  public XSSFReaderRow(SortedMap<Short, XSSFReaderSheetXMLHandler.CellValue> data) {
    this.data = data;
  }

  @Override
  public int getFirstColumn() {
    return data.firstKey();
  }

  @Override
  public int getLastColumn() {
    return data.lastKey();
  }

  @Override
  public Cell get(int column) {
    // Not supported as we don't have the underlying Apache POI Cell object.
    return null;
  }

  @Override
  public Object getCellValue(int column) {
    var cell = data.get((short) column);
    if (cell == null) {
      return null;
    }

    var dataType = cell.dataType();
    return switch (dataType) {
      case BOOL -> cell.getBooleanValue();
      case DATE -> LocalDateTime.parse(cell.strValue()); // Don't believe used by Excel.
      case INLINE_STRING, SST_STRING, FORMULA_STRING, TEXT -> cell.strValue();
      case NUMBER -> cell.getNumberValue();
      case INTEGER -> cell.getIntegerValue();
      case OLE_DATE -> cell.getDateValue();
      case OLE_DATETIME -> cell.getDateTimeValue();
      case ERROR -> null;
    };
  }

  @Override
  public String getCellText(int column) {
    var cell = data.get((short) column);
    if (cell == null) {
      return "";
    }

    var dataType = cell.dataType();
    return switch (dataType) {
      case BOOL -> cell.getBooleanValue() ? "TRUE" : "FALSE";
      case NUMBER -> String.valueOf(cell.getNumberValue());
      default -> cell.strValue();
    };
  }

  @Override
  public boolean isEmpty(int column) {
    var cell = data.get((short) column);
    return cell == null || cell.strValue().isEmpty();
  }

  @Override
  public boolean isEmpty(int start, int end) {
    int currentEnd = end == -1 ? getLastColumn() : end;
    for (int column = Math.max(getFirstColumn(), start);
        column <= Math.min(getLastColumn(), currentEnd);
        column++) {
      if (!isEmpty(column)) {
        return false;
      }
    }
    return true;
  }

  @Override
  public String[] getCellsAsText(int startCol, int endCol) {
    int currentEndCol = endCol == -1 ? getLastColumn() : endCol;

    String[] output = new String[currentEndCol - startCol + 1];
    for (int col = startCol; col <= currentEndCol; col++) {

      var cell = data.get((short) col);
      if (cell != null) {
        var dataType = cell.dataType();
        if (dataType != XSSFReaderSheetXMLHandler.XSSDataType.INLINE_STRING
            && dataType != XSSFReaderSheetXMLHandler.XSSDataType.SST_STRING) {
          return null;
        }
      }

      output[col - startCol] = cell == null ? "" : cell.strValue();
    }

    return output;
  }
}
